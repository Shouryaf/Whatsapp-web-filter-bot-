# Whatsapp-web-filter-bot-
you have to be the admin of the group and this bot auto moderates nsfw content whether its gifs, voice messages,text, images etc and for one person in my case it deletes every message he sends during the bot's runtime!.

Note:- You have to run specific commands and then the qr code png will appear you have to scan it on your mobile whatsapp linked devices.
Commands:- 
1. $env:PUPPETEER_SKIP_DOWNLOAD="true"
npm install @huggingface/transformers ffmpeg-static tesseract.js sharp
2. npm ls @huggingface/transformers ffmpeg-static tesseract.js sharp qrcode whatsapp-web.js

Run:- node index.js

IF you want to test it in the group turn "dryRun: true," it will only show the messages it would've deleted if dry run would've been set to false.
