# OmegaCases setup

One program that installs the whole site on one machine, asks for your API
keys, and tells you how to run it. Written for someone who has not deployed a
website before.

## What you need first

Nothing but the setup program itself. On a fresh machine with no Docker and no
copy of the code, setup offers to fetch both:

- **The source code** — downloaded from GitHub into `~/websites/omegacases` by
  default (`C:\Users\you\websites\omegacases` on Windows). It uses `git` when
  available, so you can pull updates later, and falls back to a zip download
  when git is not installed.
- **Docker** — installed for you on Linux (the official get.docker.com script)
  and on Windows where `winget` is available. Elsewhere, setup points you at the
  Docker Desktop download and waits for you to run setup again.

Neither happens without being described first and agreed to.

**For a public site** you also need a domain whose DNS A record points at the
machine, and ports 80 and 443 free on it.

You do not need a Supabase account, a Vercel account, or a database. Setup
creates the database itself.

## Running it

There is nothing to install: each file in `dist/` is one self-contained binary.

**Windows** — double-click `SETUP.EXE`. It can sit anywhere: in the project
folder if you already have the code, or on your desktop if you do not.

**Linux**

```
chmod +x omegacases-setup-linux
sudo ./omegacases-setup-linux
```

Use `omegacases-setup-linux-arm64` on ARM machines. `sudo` is needed because the
proxy binds ports 80 and 443, and installing Docker needs root.

Run it from inside the project folder if you already have the code, or from
anywhere if you want setup to download it.

Two options apply to the whole run:

```
--dir PATH       where the code is, or should be downloaded to
--branch NAME    which branch to download (default: release)
```

Setup asks about a dozen questions, all with sensible defaults, then does the
work. It takes around ten minutes, mostly building the site. Nothing is changed
until it has shown you a summary and you have said yes.

## What it sets up

    your domain ──► proxy (HTTPS, certificate renewed automatically)
                      ├── /                the website
                      ├── /rest/v1/*       the data API
                      ├── /realtime/v1/*   live chat, rolls, blocks, trades
                      └── /storage/v1/*    avatars and item images

Behind that: PostgreSQL with the project's schema applied, PostgREST, Realtime
and Storage. The site and its data API are served on one origin, so there is
one domain and one certificate, and no CORS configuration to get wrong.

Everything is restarted automatically if the machine reboots.

## Afterwards

    omegacases-setup status      is it running?
    omegacases-setup logs        what went wrong?
    omegacases-setup update      publish new code
    omegacases-setup stop        stop it (data is kept)
    omegacases-setup uninstall   remove it (asks twice before deleting data)

On Windows, `omega-stack\start.cmd` and `omega-stack\stop.cmd` are
double-clickable equivalents of start and stop.

Setup also writes `HOW-TO-RUN.md` into the project with the same instructions,
and `omega-setup.log` with a full transcript of what it did.

To change a key or the domain later, run setup again: it offers your previous
answers as defaults and keeps a dated backup of the old `.env.local`.

## Files it creates

| Path | What it is |
|---|---|
| `.env.local` | the site's settings and keys |
| `omega-stack/` | the deployment, proxy config, and start/stop scripts |
| `omega-stack/.env` | the generated passwords and keys — **back this up** |
| `omega-stack/omega-setup.json` | your answers, so a re-run is mostly Enter |
| `HOW-TO-RUN.md` | the instructions, to keep |
| `omega-setup.log` | transcript of the install |

All of these are added to `.gitignore`. `omega-stack/.env` is the one worth
backing up: the keys in it are what the site's data is signed with, and they
cannot be recovered.

## Using an existing Supabase project instead

Pick the second option when asked about the database and paste the project URL
and its two keys. Setup will configure the site against it but will not touch
its tables — it prints the SQL files to run in the Supabase SQL editor, in the
right order.

## Two things that are not included

The original hosting ran two background jobs as Netlify functions: the
mining-pool uptime sweep and the pool liveness test. They are not part of this
deployment. Mining pools still work; their uptime percentages just do not
update by themselves.

## Building from source

```
cd installer
bash ./build.sh          # SETUP.EXE and the Linux binaries
```

or on Windows, for the executables only:

```
cd installer
./build.ps1
```

Requires Go 1.24 or newer. There are no third-party dependencies.

## How it is put together

| Package | Responsibility |
|---|---|
| `internal/bootstrap` | fetching the source code and installing Docker on a bare machine |
| `internal/ui` | prompts, colours, the step log |
| `internal/wizard` | the questions and the summary |
| `internal/doctor` | Docker, port and DNS checks, each with a plain-language fix |
| `internal/config` | answers, secret generation, JWT signing, env files |
| `internal/stack` | the Docker templates, starting them, storage buckets, health probes |
| `internal/dbmigrate` | SQL splitting, migrations, schema verification |
| `internal/runner` | running commands and keeping the transcript |
