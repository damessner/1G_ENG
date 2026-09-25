# Deploying to GitHub Pages

There is **no access token to create.** The site is static and is published by
GitHub's own Actions runner using an automatic, per-run token. Nothing secret
is ever stored in this repository.

Pick whichever route suits you. Route A is a one-time 5-minute install; Route B
needs nothing installed at all.

---

## Route A — GitHub CLI (recommended if you will update this often)

### 1. Install Git

Download **Git for Windows** from <https://git-scm.com/download/win> and run the
installer with all defaults.

Optionally install the GitHub CLI too (comes with Git for Windows):
<https://cli.github.com/>

### 2. Log in — do this in *your own* terminal, not here

Open PowerShell and run:

```powershell
gh auth login
```

Choose: **GitHub.com → HTTPS → Login with a web browser**. It shows a one-time
code; paste it in the browser it opens. That code is safe — it expires in
minutes and is useless to anyone else.

> Never paste a personal access token into a chat, a script, or a file in this
> repository. `gh auth login` exists precisely so that no long-lived secret
> ever leaves your machine.

### 3. Publish — one command

From the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

The script does the rest: it checks prerequisites, refuses to continue if
`.venv` would ever be committed, initialises git, creates the **public**
repository, pushes, and switches Pages on. It stops and tells you what to do at
any point it needs something only you can do.

It never creates or stores an access token.

To do the same thing by hand:

```powershell
git init
git add .
git commit -m "Word Quest: alphabet, numbers, colours, classroom"
gh repo create 1G_ENG --public --source=. --push
```

`--public` is required, because GitHub Pages free hosting does not serve
private repositories on the free plan. Everything published is already your
lesson content, so there is nothing private to expose — but do check
`data/vocab.json` first if you ever add pupil names to it.

### 4. Turn on Pages

The workflow is already in `.github/workflows/deploy.yml`, so Pages switches
itself on at the first successful run. If you need to set it manually:

**repo → Settings → Pages → Source: GitHub Actions**

Your site appears at:

```
https://<your-username>.github.io/1G_ENG/
```

Allow a minute or two for the first build.

---

## Route B — no tools at all

If you would rather not install anything:

1. On GitHub, click **New repository**, name it `1G_ENG`, set it to
   **Public**, and create it **without** a README.
2. On the repo page click **uploading an existing file**.
3. Drag the whole project folder in — but **skip `.venv/`**, which is
   gitignored and is not needed to run the site.

   The site still needs these generated files committed:

   ```
   data/vocab.json
   js/data/vocab.js
   audio/manifest.js
   audio/**            (all 373 MP3s)
   ```

4. Commit.
5. **Settings → Pages → Source: Deploy from a branch → `main` / `root` → Save.**

Route B cannot run the deploy workflow, so every later update means repeating
the drag-and-drop. Route A is better if you will change words often — you only
need to re-run the audio build and `git push`.

---

## After you push: the 10-minute cache

GitHub Pages serves every file with `Cache-Control: max-age=600`, so a browser
keeps the old copy for ten minutes. Straight after a deploy you can see stale
behaviour even though the site is correct:

- a setting you just added appears to be missing
- new audio does not play yet
- the page half-updates, mixing old and new files

**This is the cache, not a broken deploy.** Check the real file before you start
debugging:

```powershell
(Invoke-WebRequest https://damessner.github.io/1G_ENG/js/core/engine.js -UseBasicParsing).Content -match 'longPromptSeconds'
```

If that is `True`, the deploy is fine. In a browser, a hard refresh
(**Ctrl+Shift+R**, or **Cmd+Shift+R** on a Mac) forces the new copies.

For a class this only matters in the ten minutes after you change something. If
you are not sure a pupil has the current version, close and reopen the tab.

The game degrades rather than breaks when it meets an older file: if the audio
manifest is stale and has no clip lengths, the engine simply repeats every
prompt the normal number of times instead of capping long ones.

---

## A note on the audio files

The MP3 pack is 5.1 MB. Commit it once and only re-commit when you actually
change words, because each commit of changed audio adds to the repository's
history permanently — even if you later revert the change.

If you are only ever tweaking the *code* and not the vocabulary, the audio
folder will not change and your commits will stay tiny.

---

## Keeping it private

The repository has to be public for free Pages hosting. If the lesson content
is sensitive, keep the repository private and publish instead to a free static
host that allows private sources, or run the site from a local folder on the
classroom machine — it works identically from `file://` with no server at all.
