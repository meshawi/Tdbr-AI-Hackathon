"""BGE-M3 embedder: dense (1024-d, cosine) + learned sparse (lexical) vectors from one forward pass.

Implemented directly on transformers so it runs on Python 3.14 without the FlagEmbedding package:
  dense  = L2-normalised [CLS] hidden state
  sparse = relu(sparse_linear(hidden)) per token, max-pooled per token id, special tokens removed
`sparse_linear.pt` is the official head shipped in the BAAI/bge-m3 repository.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np
import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModel, AutoTokenizer

MODEL_ID = os.environ.get("RAG_EMBED_MODEL", "BAAI/bge-m3")
MAX_LENGTH = int(os.environ.get("RAG_MAX_TOKENS", "1024"))


@dataclass
class Embeddings:
    dense: np.ndarray                     # (n, 1024) float32, unit length
    sparse: list[dict[int, float]]        # token id -> weight


class BgeM3:
    def __init__(self, device: str | None = None, fp16: bool = True):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        dtype = torch.float16 if (fp16 and self.device == "cuda") else torch.float32
        self.model = AutoModel.from_pretrained(MODEL_ID, torch_dtype=dtype).to(self.device).eval()
        head = torch.load(hf_hub_download(MODEL_ID, "sparse_linear.pt"), map_location="cpu")
        self.sparse_linear = torch.nn.Linear(self.model.config.hidden_size, 1)
        self.sparse_linear.load_state_dict(head)
        self.sparse_linear = self.sparse_linear.to(self.device, dtype=dtype).eval()
        special = {self.tokenizer.cls_token_id, self.tokenizer.eos_token_id, self.tokenizer.pad_token_id, self.tokenizer.unk_token_id}
        self.special_ids = {i for i in special if i is not None}

    @torch.inference_mode()
    def encode(self, texts: list[str], batch_size: int = 16, max_length: int = MAX_LENGTH, sparse: bool = True) -> Embeddings:
        dense_out: list[np.ndarray] = []
        sparse_out: list[dict[int, float]] = []
        # sort by length so padding is minimal, restore order at the end
        order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
        for start in range(0, len(order), batch_size):
            idx = order[start : start + batch_size]
            batch = [texts[i] for i in idx]
            enc = self.tokenizer(batch, padding=True, truncation=True, max_length=max_length, return_tensors="pt").to(self.device)
            hidden = self.model(**enc).last_hidden_state
            dense = torch.nn.functional.normalize(hidden[:, 0], dim=-1).float().cpu().numpy()
            dense_out.append(dense)
            if sparse:
                weights = torch.relu(self.sparse_linear(hidden)).squeeze(-1)  # (b, L)
                ids = enc["input_ids"]
                mask = enc["attention_mask"].bool()
                for row in range(ids.shape[0]):
                    d: dict[int, float] = {}
                    tok = ids[row][mask[row]].tolist()
                    w = weights[row][mask[row]].float().tolist()
                    for t, v in zip(tok, w):
                        if t in self.special_ids or v <= 0:
                            continue
                        if v > d.get(t, 0.0):
                            d[t] = v
                    sparse_out.append(d)
        dense_all = np.concatenate(dense_out) if dense_out else np.zeros((0, 1024), dtype=np.float32)
        # unsort
        inv = np.empty(len(order), dtype=np.int64)
        inv[np.array(order)] = np.arange(len(order))
        dense_all = dense_all[inv]
        sparse_all = [sparse_out[i] for i in inv] if sparse else []
        return Embeddings(dense=dense_all, sparse=sparse_all)


_singleton: BgeM3 | None = None


def get_embedder() -> BgeM3:
    global _singleton
    if _singleton is None:
        _singleton = BgeM3()
    return _singleton
