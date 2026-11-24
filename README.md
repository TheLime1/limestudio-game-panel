# LimeStudio game panel

[Open the live panel](https://thelime1.github.io/limestudio-game-panel/) · [Edit the playlist](https://github.com/TheLime1/limestudio-game-panel/edit/main/games.json)

An edge-to-edge game shelf for an s&box popup. It shows up to four games and fills its parent viewport. Hover or focus a card to play its muted preview. Click, tap or press Enter to open the official game page in the current panel.

## Curate the shelf

Edit the top-level `playlist` array in [games.json](games.json) on GitHub and commit to `main`. GitHub Pages publishes the change. Games keep the same embed URL. Keep the full `games` catalog underneath the playlist so you can feature a title again later.

With one to four IDs, cards follow the exact playlist order. A longer playlist draws four distinct games per opening. The current playlist features Fish Together, Blue Cell, REtanks and Spellstorm. Open panels check for published changes once a minute while visible and retain their selection when the pool stays the same.

Example playlist value:

```json
["fish_together", "blue_cell", "retanks", "spellstorm"]
```

## Embed in s&box

Place a WebPanel in your popup's Razor markup, with a parent that has a definite size. This example fills that parent and omits Fish Together from its own recommendations. Remove the query string for the full pool.

```razor
@using Sandbox.UI

<WebPanel Url="https://thelime1.github.io/limestudio-game-panel/?exclude=fish_together"
          style="width: 100%; height: 100%; pointer-events: all;" />
```

| Placement | Suggested content size | Approximate size per card |
| --- | --- | --- |
| Four-game popup | 640 × 360 | 319 × 179 |
| Smaller popup | 480 × 270 | 239 × 134 |
| Four-game strip | 960 × 135 | 238 × 135 |

Auto layout chooses a grid, row or vertical stack based on the crop required for each card. The four featured games have wide (16:9), square (1:1) and tall (9:16) artwork from their s&box thumbnail settings. Each card picks the closest composition. For example, a 360 × 360 popup uses four square covers, and a 360 × 640 popup uses four tall covers. The browser selects the image resolution for the slot width and pixel density. Hover previews keep the full video frame in square and tall cards. For a dedicated slot append `?layout=grid` or `?layout=strip`. Combine options with `&`, for example `?layout=strip&exclude=spellstorm`. The exclude value is the exact catalog ID.

Facepunch's WebPanel sets the browser size from its laid-out rectangle, applies the panel's screen scale, and forwards mouse movement and clicks. Set the size of the popup in your UI and let the WebPanel fill it. For a popup kept alive while hidden, set its `Surface.InBackgroundMode` to true while closed and false when shown. Removing the WebPanel also disposes the surface.

[WebPanel API](https://sbox.game/api/Sandbox.UI.WebPanel/) · [WebPanel engine source](https://github.com/Facepunch/sbox-public/blob/master/engine/Sandbox.Engine/Systems/UI/Controls/WebPanel.cs) · [WebSurface API](https://sbox.game/api/Sandbox.WebSurface)

## Media and hosting

The site serves responsive WebP covers for the four featured games, 640 × 360 fallback posters for the catalog and original small AV1 WebM previews from [media](media). A VP8 copy of each clip is included for browsers with limited codec support. Only one preview loads at a time. Leaving a card releases the video. Reduced-motion users see the poster.

GitHub Pages serves the root of `main`. All resource paths are relative, so the same files also work under a subdirectory on another static host. For a local preview, run `python3 -m http.server 8080` in this directory and open `http://localhost:8080/` in a browser.
