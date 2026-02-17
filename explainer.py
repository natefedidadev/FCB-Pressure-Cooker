import os
from openai import OpenAI

# key
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
# choose model
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

def _get_client() -> OpenAI:
    api_key = OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable is not set")
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)

def call_llm(prompt: str, system_prompt: str | None = None) -> str:
    client = _get_client()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    model = OPENROUTER_MODEL or os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

    response = client.chat.completions.create(model=model, messages=messages)

    # response object has a `choices` list, each choice has a `message` (this is the LLM output)
    return response.choices[0].message.content

if __name__ == "__main__":
    print(f"Model:  {OPENROUTER_MODEL}")
    print(f"API key set: {bool(OPENROUTER_API_KEY)}")
    print()

    try:
        result = call_llm(
            prompt="In one sentence, what is a defensive transition in football?",
            system_prompt="You are a football tactical analyst. Be concise.",
        )
        print(f"Response: {result}")
    except ValueError as e:
        print(f"Setup error: {e}")
    except Exception as e:
        print(f"API error: {e}")
