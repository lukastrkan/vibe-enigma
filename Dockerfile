FROM nginx:alpine

# Copy static web assets to Nginx default document root
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY enigma.js /usr/share/nginx/html/
COPY audio.js /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
