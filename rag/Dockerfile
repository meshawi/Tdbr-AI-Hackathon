# Assistant + retrieval API (FastAPI). CPU image; set RAG_RERANK=0 or RAG_PREFETCH=20 on small machines.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/models
WORKDIR /app

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "transformers>=4.45" huggingface_hub safetensors numpy tqdm "qdrant-client>=1.12" fastapi "uvicorn[standard]" openai

# Pre-download the models into the image so the container starts without network access to Hugging Face.
RUN python -c "from huggingface_hub import snapshot_download as d; \
  d('BAAI/bge-m3', allow_patterns=['*.json','*.safetensors','sparse_linear.pt','sentencepiece.bpe.model','tokenizer*']); \
  d('BAAI/bge-reranker-v2-m3', allow_patterns=['*.json','*.safetensors','sentencepiece.bpe.model','tokenizer*'])"

# application code + the small data the API needs (verse text, chapters, reflections, coverage)
COPY rag/*.py rag/coverage.json ./rag/
COPY public/data/chapters.json public/data/reflections.json ./public/data/
COPY public/data/surah ./public/data/surah
COPY scripts/chapter-meta.mjs ./scripts/chapter-meta.mjs

VOLUME ["/app/rag/data"]
EXPOSE 8000
CMD ["uvicorn", "serve:app", "--app-dir", "rag", "--host", "0.0.0.0", "--port", "8000"]
