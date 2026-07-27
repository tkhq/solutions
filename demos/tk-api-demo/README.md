# Turnkey API Demo

Interactive walkthroughs of Turnkey's wallet infrastructure and policy engine. All API calls are real.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy the example env file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `API_PUBLIC_KEY` | Turnkey API public key (starts with `02` or `03`) |
   | `API_PRIVATE_KEY` | Turnkey API private key |
   | `ORGANIZATION_ID` | Turnkey organization ID |

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)
