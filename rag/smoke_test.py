"""Quick GPU smoke test for the embedder: shapes, speed, and a sanity similarity check."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import torch  # noqa: E402

from embedder import get_embedder  # noqa: E402
from textnorm import normalize  # noqa: E402

print("torch", torch.__version__, "cuda", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "-")
t0 = time.time()
e = get_embedder()
print("model loaded in", round(time.time() - t0, 1), "s")

samples = [
    "﴿اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ﴾ أي: دلنا وأرشدنا إلى الطريق الواضح الذي لا اعوجاج فيه",
    "ما معنى الصراط المستقيم",
    "الحمد لله رب العالمين: الثناء على الله بصفاته",
]
texts = [normalize(x) for x in samples] * 8
t0 = time.time()
emb = e.encode(texts, batch_size=24)
dt = time.time() - t0
print("dense", emb.dense.shape, "norm", round(float((emb.dense[0] ** 2).sum()) ** 0.5, 3), "| sparse sizes", [len(s) for s in emb.sparse[:3]], "| %.0f texts/s" % (len(texts) / dt))
print("sim(tafsir, question)=%.3f  sim(tafsir, other)=%.3f" % (float(emb.dense[0] @ emb.dense[1]), float(emb.dense[0] @ emb.dense[2])))
tok = e.tokenizer
print("sparse tokens of question:", [(tok.convert_ids_to_tokens(i), round(v, 2)) for i, v in sorted(emb.sparse[1].items(), key=lambda x: -x[1])[:6]])
print("GPU mem GB", round(torch.cuda.max_memory_allocated() / 1e9, 2))
