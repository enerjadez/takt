# TAKT

Local video editor for your Android tablet. Cut clips to original music, overlay text, export to the device. Nothing goes to the cloud.

Same idea as BLAST: this PC runs a tiny server, the tablet opens a link on your Wi-Fi.

## On the tablet (no PC needed)

Send `TAKT.html` to the tablet (BLAST it, USB, Drive — whatever). Open it **in Chrome**. That is the whole app.

- Clips and your own songs come from the tablet gallery.
- **Songs** tab needs internet (real recorded tracks from Audius).
- **Originals** and imported files work offline.
- Chrome → Add to Home screen if it offers it.

Rebuild the single file after code changes:

```bat
python C:\Users\jaden\takt\build_standalone.py
```

Writes `C:\Users\jaden\takt\TAKT.html` and a copy on the Desktop.

## Run it from the PC (LAN)

Double-click the desktop **TAKT** shortcut, or:

```bat
C:\Users\jaden\takt\takt.bat
```

Leave the window open. On the tablet (same Wi-Fi, Chrome):

1. Scan the QR in the TAKT window, or type the printed `http://192.168.x.x:7755/` URL.
2. Chrome menu → **Add to Home screen**. It launches like an app.
3. New project → add videos from the tablet gallery → pick a sound → export.

Exports land in the tablet **Downloads** folder. Share to WhatsApp, TikTok, gallery, wherever.

### Windows firewall (once)

If the tablet cannot open the page, Admin PowerShell:

```powershell
netsh advfirewall firewall add rule name="TAKT LAN" dir=in action=allow protocol=TCP localport=7755 profile=private
```

## What it does

- Multi-clip timeline — trim, split, reorder, copy, delete
- 24 original instrumentals (trap, drill, house, lo-fi, amapiano, phonk, pop, cinematic) plus SFX
- Import your own songs from the tablet
- Beat markers + **Beats** auto-cut (splits the clip on the song)
- Text styles, stickers, 15 color looks, light/vignette/grain
- Speed, reverse, mute, original-audio ducking under the song
- 9:16 / 1:1 / 16:9 / 4:5 / 3:4 / 4:3
- In-app camera + voiceover
- Drafts saved on the tablet (IndexedDB)
- Export 720p or 1080p to Downloads (mp4 when Chrome allows it, otherwise webm)

Music in the library is original to TAKT — not ripped TikTok audio. Your own files stay on the device.

## Notes

- Same 5/6 GHz Wi-Fi as this PC. Not guest Wi-Fi, not AP isolation.
- Videos never upload. Only the editor UI is served from the PC. Media is picked and stored on the tablet.
- If the PC sleeps, the tablet page dies until you start TAKT again. After **Add to Home screen** once, Chrome still caches the shell — reopen TAKT on the PC to edit.
- Long 4K clips can choke a tablet. 1080p/720p sources export cleaner.

## Requirements

Python 3.9+ (stdlib only). QR encoder vendored from [Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (MIT).
