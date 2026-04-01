"""
AiAssist Client
Thin wrapper for the AiAssist.net BYOK orchestration platform.
Uses /v1/providers and /v1/chat/completions endpoints.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

logger = logging.getLogger("jenny.aiassist")


class AiAssistClient:
    """Client for AiAssist.net API — BYOK LLM orchestration.

    Authentication: Bearer token (API key starting with aai_)
    Provider selection: X-AiAssist-Provider header

    Endpoints used:
        GET  /v1/providers          — list user's configured providers + models
        POST /v1/chat/completions   — OpenAI-compatible chat completions
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.aiassist.net",
        default_provider: str = "",
        timeout: float = 120.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.default_provider = default_provider
        self.timeout = timeout

    def _headers(self, provider: Optional[str] = None) -> Dict[str, str]:
        """Build request headers with auth and provider selection."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        p = provider or self.default_provider
        if p:
            headers["X-AiAssist-Provider"] = p
        return headers

    async def get_providers(self) -> Dict[str, Any]:
        """GET /v1/providers — Fetch user's configured providers and models.

        Returns:
            {
                "default_provider": "groq",
                "providers": [
                    {
                        "name": "groq",
                        "models": [{"id": "llama-3.3-70b-versatile", ...}],
                        ...
                    },
                    ...
                ],
                "fallback_chain": ["groq", "openai"]
            }
        """
        if not self.api_key:
            logger.warning("AiAssist API key not configured")
            return {"providers": [], "default_provider": None, "fallback_chain": []}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/v1/providers",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as e:
                logger.error(f"Failed to fetch providers: {e}")
                return {"providers": [], "default_provider": None, "error": str(e)}

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "llama-3.3-70b-versatile",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """POST /v1/chat/completions — OpenAI-compatible chat completion.

        Args:
            messages: List of {role, content} message dicts
            model: Model ID (from providers endpoint)
            provider: Override provider via X-AiAssist-Provider header
            temperature: Sampling temperature 0-2
            max_tokens: Max output tokens
            stream: Enable SSE streaming (returns async iterator)

        Returns:
            OpenAI-compatible completion response
        """
        if not self.api_key:
            return {
                "error": "AiAssist API key not configured. Set JENNY_AIASSIST_API_KEY.",
                "choices": [],
            }

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    headers=self._headers(provider),
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as e:
                logger.error(f"Chat completion failed: {e}")
                return {"error": str(e), "choices": []}

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "llama-3.3-70b-versatile",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        """Stream chat completions via SSE.

        Yields:
            Content delta strings as they arrive
        """
        if not self.api_key:
            yield "[Error: AiAssist API key not configured]"
            return

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/v1/chat/completions",
                headers=self._headers(provider),
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            import json
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue

    def get_content(self, response: Dict[str, Any]) -> str:
        """Extract text content from a chat completion response."""
        choices = response.get("choices", [])
        if not choices:
            return response.get("error", "No response")
        return choices[0].get("message", {}).get("content", "")
