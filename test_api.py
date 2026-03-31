import httpx
import json
import asyncio

async def test_api():
    settings = {
        "api_key": "aai_WsrkQdSo0bl5gjeYnj4_oyaNBI-Pm7Dh4nt2S_h1OY8",
        "api_base": "https://api.aiassist.net",
        "model": "moonshotai/kimi-k2-instruct"
    }
    
    headers = {
        "Authorization": f"Bearer {settings['api_key']}",
        "Content-Type": "application/json"
    }
    
    AGENT_TOOLS = [
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read file contents",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"}
                    },
                    "required": ["path"]
                }
            }
        }
    ]

    # Test Multi-turn Tool Calling (Simulation)
    print("--- Test: Multi-turn Tool Response ---")
    messages = [
        {"role": "system", "content": "You are a code surgeon."},
        {"role": "user", "content": "Read App.jsx"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {
                        "name": "read_file",
                        "arguments": '{"path": "App.jsx"}'
                    }
                }
            ]
        },
        {
            "role": "tool",
            "tool_call_id": "call_123",
            "content": "File: App.jsx\n1| import React from 'react';"
        }
    ]
    
    payload_multi = {
        "model": settings["model"],
        "messages": messages,
        "tools": AGENT_TOOLS,
        "temperature": 0.0
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings['api_base']}/v1/chat/completions",
                json=payload_multi,
                headers=headers,
                timeout=15
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            if resp.status_code == 200:
                print("SUCCESS: Multi-turn tool use works!")
            else:
                print(f"FAIL: Multi-turn failed with {resp.status_code}")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
