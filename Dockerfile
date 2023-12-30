FROM caddy:latest

RUN apk add --no-cache nodejs npm
RUN mkdir /build
COPY . /build
ENV BUILD_MODE="production"
ENV NODE_ENV="development"

RUN cd /build &&\
npm install 

RUN cd /build &&\
echo $PATH &&\
npm run build &&\
mv /build/dist/* /usr/share/caddy &&\
cd / &&\
rm -rf /build




