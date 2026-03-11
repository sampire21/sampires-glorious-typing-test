FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY bible-verses.js /usr/share/nginx/html/bible-verses.js
COPY sw.js /usr/share/nginx/html/sw.js
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY Favicon.png /usr/share/nginx/html/Favicon.png
COPY typemine-galactic-logo.png /usr/share/nginx/html/typemine-galactic-logo.png
COPY icons/ /usr/share/nginx/html/icons/
COPY "Sound Effects/" "/usr/share/nginx/html/Sound Effects/"
EXPOSE 80
