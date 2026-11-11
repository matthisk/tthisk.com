# tthisk.com

Personal site for Matthis (software engineer): HTML, CSS and JS with no build step, no framework and no dependencies beyond Google Fonts (JetBrains Mono).

## Design

The look is a terminal window running a tmux session, in the Tokyo Night palette. Each section is a tmux **window** that shows the output of a shell command (`ls -lt blog/`, `tree projects/`, `cat about.txt`), with a tmux status line along the bottom. New pages and features belong inside that metaphor: write them as command output rather than as ordinary web pages.

- Keys: `0-3` switch windows, `Ctrl-b n/p` next/previous, `Ctrl-b ?` help, `Ctrl-b d` detach. Inside a post: `space`/`b` page, `g`/`G` ends, `q` quit.
- Easter eggs: a clickable `fortune | cowsay`, `sudo`, `ls -la` (shows `.dotfiles/` and `.drafts.md`).

## Layout

`index.html` holds the CSS in `<style>`, the markup, then one inline `<script>`. The site's text is in `content.json`: the fetch info, intro, fortunes, posts, projects, and about (text, `me.toml`, git log). `render()` in the script reads it at startup and fills empty containers in the markup. Commands, prompts, key help and easter eggs are UI chrome and stay in `index.html`. Full post bodies are HTML fragments in `posts/`. Images for posts are in `img/`.

- Four `<section class="win" data-win="N">` elements: `0` home, `1` blog, `2` projects, `3` about. `NAMES` in the script maps them to hash routes (`#blog`, `#projects`, `#about`).
- A blog post is opened at `#blog/N`, where `N` is its index in `posts` in `content.json`. Append new posts at the end so existing URLs keep working; the blog list and the home page's recent list sort by `date` on their own.
- Because the page `fetch`es its text, it must be served over HTTP; opening it from `file://` shows a load error.

### Projects

`projects.groups` in `content.json` is rendered as `tree -L 2 projects/`: each group (`personal/` for educational, then `work/` for professional) has a `note` and `items`. An item has `name`, `tag`, `text` (a string or an array of paragraphs) and an optional `href`; without `href` the name is plain text, which suits work projects with nothing public to link to.

### Adding a blog post

Add an entry to `posts` in `content.json`: `slug`, `title`, `date` (`YYYY-MM-DD`), `read`, `size`, `description` (the `# ...` comment in `ls`), `summary` (array of paragraphs) and, optionally, `file`, a path to a full HTML body such as `posts/my-post.html`. `openPost()` fetches that file and inserts it as trusted HTML. Without `file`, the post shows its escaped summary and a placeholder line.

Give figures and images `alt` text or a `<title>`, as the existing posts do.

## Preview

```sh
python3 -m http.server 8765   # then open http://localhost:8765/
```

Browsers cache aggressively with this server, so add `?v=N` to the URL after edits.

## Conventions

- Content is mostly **placeholder**. The real content so far is post 0 (tiny Lisp) and post 4 (asynchronous streams, imported from the old matthisk.com). `webmaster@tthisk.com` is made up. The GitHub link assumes `github.com/matthisk`.
- Respect `prefers-reduced-motion`. The typing animation checks the `reduce` flag.
- Pass any user-supplied or generated text through `esc()` before putting it in `innerHTML`. Every `content.json` field is escaped, so it is plain text, not HTML. Only the `posts/*.html` bodies are inserted as-is.
- Commit only when asked.
