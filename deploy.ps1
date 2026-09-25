<#
  deploy.ps1 — create the GitHub repository and publish the site.

  Run this from the project folder:

      powershell -ExecutionPolicy Bypass -File .\deploy.ps1

  It stops and asks for input at any point it needs something only you can do.
  No personal access token is created or stored at any stage.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)       { Write-Host "    OK  $msg" -ForegroundColor Green }
function Need($msg)    { Write-Host "    !!  $msg" -ForegroundColor Yellow }

# ---------------------------------------------------------------- 1
Step 1 "Checking prerequisites"

$hasGit = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if (-not $hasGit) {
    Need "Git is not installed."
    Write-Host "    Install it from https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "    (all defaults are fine), then run this script again.`n" -ForegroundColor Yellow
    exit 1
}
Ok "git: $((git --version))"

$hasGh = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)
if (-not $hasGh) {
    Need "GitHub CLI (gh) is not installed."
    Write-Host "    Install from https://cli.github.com/ , then run this script again.`n" -ForegroundColor Yellow
    exit 1
}
Ok "gh: installed"

# ---------------------------------------------------------------- 2
Step 2 "Checking sign-in"

$authed = $false
try { gh auth status *> $null; $authed = $LASTEXITCODE -eq 0 } catch { $authed = $false }

if (-not $authed) {
    Need "You are not signed in to GitHub yet."
    Write-Host @"

    This is the only step that needs you, and it does NOT use an access token.
    Run this in your own terminal:

        gh auth login

    Choose:  GitHub.com  ->  HTTPS  ->  "Login with a web browser"

    It will show a one-time code that you paste into the page it opens.
    That code is short-lived and safe -- it is NOT a password and NOT a token,
    so it is fine even though other people can see this screen.

    After signing in, come back and run this script again.
"@ -ForegroundColor Yellow
    exit 1
}
$ghUser = (gh api user --jq .login)
Ok "signed in as $ghUser"

# ---------------------------------------------------------------- 3
Step 3 "Checking what will be committed"

if (-not (Test-Path '.git')) {
    git init -q
    Ok "initialised a git repository"
}

# .venv is gitignored, but prove it rather than assume it
$venvTracked = @(git status --porcelain | Select-String '\.venv')
if ($venvTracked) {
    Need ".venv would be committed -- aborting."
    exit 1
}

$files = @(git status --porcelain)
$mp3 = @($files | Select-String '\.mp3$').Count
Ok "$($files.Count) paths staged, including $mp3 audio files"
Ok ".venv correctly excluded"

# ---------------------------------------------------------------- 4
Step 4 "Committing"

git add -A
if ($LASTEXITCODE -ne 0) { Need "git add failed"; exit 1 }

if ([string]::IsNullOrWhiteSpace((git diff --cached --name-only))) {
    Ok "nothing new to commit"
} else {
    git commit -q -m "Word Quest: alphabet, numbers, colours and classroom games"
    if ($LASTEXITCODE -ne 0) { Need "commit failed"; exit 1 }
    Ok "committed"
}

# ---------------------------------------------------------------- 5
Step 5 "Creating the repository and publishing"

$repoName = "word-quest"
$exists = $false
try { gh repo view "$ghUser/$repoName" *> $null; $exists = ($LASTEXITCODE -eq 0) } catch { $exists = $false }

if ($exists) {
    Ok "repository $ghUser/$repoName already exists"
    git remote get-url origin *> $null
    if ($LASTEXITCODE -ne 0) { git remote add origin "https://github.com/$ghUser/$repoName.git" }
    git push -q origin HEAD:main
    if ($LASTEXITCODE -ne 0) { Need "push failed"; exit 1 }
    Ok "pushed"
} else {
    Write-Host "    Creating PUBLIC repository $ghUser/$repoName ..." -ForegroundColor Gray
    Write-Host "    (public is required: free GitHub Pages does not serve private repos)`n" -ForegroundColor Gray
    gh repo create $repoName --public --source=. --push --description "Audio-first English practice games" 2>&1 |
        ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) { Need "repo creation failed"; exit 1 }
    Ok "created and pushed"
}

# ---------------------------------------------------------------- 6
Step 6 "Enabling Pages"

Write-Host "    Trying to switch Pages on ..." -ForegroundColor Gray
try { gh api -X POST "repos/$ghUser/$repoName/pages" -f "source[branch]=main" -f "source[path]=/" *> $null } catch { }
Start-Sleep -Seconds 2

$url = "https://$ghUser.github.io/$repoName/"
Write-Host @"

    ----------------------------------------------------------------
     Published. Pages builds on the first push, usually 1-2 minutes.

       $url

     First time only, if the URL 404s:
       repo -> Settings -> Pages -> Source: GitHub Actions
     ----------------------------------------------------------------
"@ -ForegroundColor Green
