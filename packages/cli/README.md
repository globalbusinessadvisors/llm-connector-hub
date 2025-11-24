# @llm-dev-ops/cli

Command-line interface for LLM Connector Hub - a unified CLI for interacting with multiple Large Language Model providers.

## Installation

```bash
npm install -g @llm-dev-ops/cli
```

## Quick Start

1. **Initialize configuration:**
   ```bash
   llm-hub config init
   ```

2. **Set API keys:**
   ```bash
   llm-hub config set providers.openai.apiKey "your-api-key"
   llm-hub config set providers.anthropic.apiKey "your-api-key"
   llm-hub config set providers.google.apiKey "your-api-key"
   ```

3. **Test provider connectivity:**
   ```bash
   llm-hub providers test openai
   ```

4. **Get a completion:**
   ```bash
   llm-hub complete "What is TypeScript?" --provider openai
   ```

5. **Start interactive chat:**
   ```bash
   llm-hub chat --provider anthropic --model claude-3-opus-20240229
   ```

## Commands

### `complete`

Get a single completion from an LLM provider.

```bash
llm-hub complete <prompt> [options]

Options:
  -p, --provider <provider>    LLM provider (openai, anthropic, google) (default: "openai")
  -m, --model <model>          Model to use
  -t, --temperature <number>   Temperature (0-2)
  --max-tokens <number>        Maximum tokens to generate
  --stream                     Stream the response
  --json                       Output as JSON
```

**Examples:**

```bash
# Basic completion
llm-hub complete "Explain quantum computing"

# With specific provider and model
llm-hub complete "Write a haiku" --provider anthropic --model claude-3-sonnet-20240229

# Stream response
llm-hub complete "Tell me a story" --stream

# JSON output
llm-hub complete "What is AI?" --json
```

### `chat`

Start an interactive chat session.

```bash
llm-hub chat [options]

Options:
  -p, --provider <provider>    LLM provider (openai, anthropic, google) (default: "openai")
  -m, --model <model>          Model to use
  -t, --temperature <number>   Temperature (0-2) (default: 0.7)
  --max-tokens <number>        Maximum tokens to generate (default: 1000)
  --system <message>           System message
```

**Examples:**

```bash
# Start chat with default provider
llm-hub chat

# Chat with specific provider and model
llm-hub chat --provider anthropic --model claude-3-opus-20240229

# Chat with system message
llm-hub chat --system "You are a helpful coding assistant"
```

### `config`

Manage CLI configuration.

```bash
llm-hub config <subcommand>

Subcommands:
  show              Show current configuration
  set <key> <value> Set a configuration value
  get <key>         Get a configuration value
  init              Initialize configuration interactively
```

**Examples:**

```bash
# Show current configuration
llm-hub config show

# Set API key
llm-hub config set providers.openai.apiKey "sk-..."

# Get default provider
llm-hub config get defaultProvider

# Interactive setup
llm-hub config init
```

### `providers`

Manage LLM providers.

```bash
llm-hub providers <subcommand>

Subcommands:
  list              List available providers
  test <provider>   Test provider connectivity
  models <provider> List available models for a provider
```

**Examples:**

```bash
# List all providers
llm-hub providers list

# Test OpenAI connectivity
llm-hub providers test openai

# List Anthropic models
llm-hub providers models anthropic
```

## Configuration

Configuration is stored in `~/.llm-hub/config.json`.

### Configuration File Format

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "sk-..."
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "google": {
      "apiKey": "..."
    }
  },
  "defaults": {
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

### Environment Variables

You can also set API keys via environment variables:

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_AI_API_KEY` - Google AI API key

## Supported Providers

### OpenAI
- **Provider ID:** `openai`
- **Models:** gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo, etc.

### Anthropic (Claude)
- **Provider ID:** `anthropic`
- **Models:** claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307

### Google AI (Gemini)
- **Provider ID:** `google`
- **Models:** gemini-pro, gemini-pro-vision

## Examples

### Basic Usage

```bash
# Quick completion
llm-hub complete "What is the capital of France?"

# Stream a longer response
llm-hub complete "Write a short story about a robot" --stream --max-tokens 2000

# Use different provider
llm-hub complete "Explain machine learning" --provider anthropic
```

### Interactive Chat

```bash
# Start chat
llm-hub chat

You: Hello!
Assistant: Hi! How can I help you today?

You: What's the weather like?
Assistant: I don't have access to real-time weather data...

You: exit
Goodbye!
```

### Configuration Management

```bash
# Initialize config
llm-hub config init

# Set default provider
llm-hub config set defaultProvider anthropic

# Set default temperature
llm-hub config set defaults.temperature 0.8

# View configuration
llm-hub config show
```

### Provider Testing

```bash
# Test all providers
llm-hub providers test openai
llm-hub providers test anthropic
llm-hub providers test google

# List available models
llm-hub providers models openai
```

## License

MIT OR Apache-2.0
