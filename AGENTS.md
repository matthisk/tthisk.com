# tthisk.com

Personal portfolio and blog for Matthis (software engineer). The site will have three sections: **blog**, **about**, **projects**.

## Current state: design exploration

The repo holds eleven competing design directions for the **home page only**. Nobody has picked one yet. Once the user chooses, build the blog, about and projects pages in that style. Until then, don't build them.

Each folder is self-contained, with no build step, no framework and no dependencies beyond Google Fonts:

| Folder | Concept | Notes |
|---|---|---|
| `01-phosphor-terminal/` | Green CRT with a working shell (`help`, `blog`, `read 2`, `theme`) | Boot sequence, amber toggle |
| `02-classic-desktop/` | 1-bit 1984-style desktop: draggable windows, menus | Windows stack vertically on mobile |
| `03-tui-workspace/` | tmux/lazygit-style panes, vim keys (`1-5`, `j/k`, `?`) | Most practical for long-form reading |
| `04-bios-setup/` | Blue BIOS setup screen, startup check, arrow-key navigation | F10 "reboots" |
| `05-plain-html/` | Early web, looks unstyled but tuned to be readable | Easiest to turn into the real site |
| `06-geocities-homepage/` | Late-90s homepage: guestbook, hit counter, chiptune | Guestbook and counter use localStorage only |
| `07-kingdom-of-code/` | Playable isometric strategy game; each building is a site section | Multi-file, see below |
| `08-mono-dark/` | 05's simplicity in a dark, monospace, terminal-inspired style | Not interactive; section headings are shell prompts |
| `09-neovim/` | Neovim session: buffer tabs, line numbers, `~` filler, status line, `:` commands | Eggs: `:q` (escalates), `g.` in blog/ shows `.secret` |
| `10-tmux-session/` | Terminal window with a tmux status line; each window shows command output. Tokyo Night palette. **Current favourite** | Keys `0-3`, `Ctrl-b n/p/?/d`. Eggs: clickable cowsay, `sudo`, `ls -la` |
| `11-agent-session/` | Chat with a made-up coding agent in the terminal; input box and status line | Slash commands. Eggs: `rm -rf` permission prompt, `/cost`, `sudo` |

Each `index.html` is a single page, except design 07.

## Preview

```sh
python3 -m http.server 8765   # then open http://localhost:8765/<folder>/
```

Browsers cache aggressively with this server, so add `?v=N` to the URL after edits.

## Design 07 (kingdom-of-code) layout

Plain `<script>` files that share one global scope, loaded in this order:

- `data.js`: **all visitor-facing content** (SITE, POSTS, PROJECTS), game constants, the state object `S`, and helpers
- `audio.js`: Web Audio sound effects and generative music (no audio files)
- `world.js`: terrain generation, map grids, A* pathfinding, fog of war
- `draw.js`: procedural drawing of buildings, sprites and units (no image assets)
- `sim.js`: unit behaviour, gathering, training, ages, the Wonder, particles
- `ui.js`: the bottom panel and command buttons, modals, objectives, chat and cheats, classic view
- `main.js`: camera, render loop, input, minimap, startup

Because they share a global scope, top-level names must be unique across files. A `box` clash has already caused a bug once.

Concatenate the files to syntax-check them:
`cat data.js audio.js world.js draw.js sim.js ui.js main.js > /tmp/all.js && node --check /tmp/all.js`

It is **original**: inspired by the real-time strategy genre, not a copy of Age of Empires II. Don't add that game's names, art, sounds or interface, or references to it.

## Conventions

- All content (posts, projects, bio, email) is **placeholder**. `webmaster@tthisk.com` is made up. The GitHub link assumes `github.com/matthisk`.
- Respect `prefers-reduced-motion` in every design.
- Escape any user or chat input before putting it in `innerHTML`. There's an `esc()` helper in most designs.
- Not a git repo yet. Commit only when asked.
