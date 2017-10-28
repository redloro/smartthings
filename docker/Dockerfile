FROM arm32v6/alpine:latest
# FROM alpine:latest

ARG architecture="armv6"
ARG build_date
ARG repo="redloro"
ARG branch="master"

LABEL org.label-schema.schema-version="1.0" \
      org.label-schema.name="rpi-smartthings-nodeproxy" \
      org.label-schema.description="SmartThings Node Proxy for Raspberry Pi" \
      org.label-schema.version="1.0.2" \
      org.label-schema.docker.cmd="docker run -d -p 8080:8080 -e ENABLED_PLUGINS='dash' rpi-smartthings-nodeproxy" 
#      org.label-schema.build-date=$build_date \
#      architecture=$architecture

ENV NODE=/usr/local/bin/node
ENV NPM=/usr/local/bin/npm
ENV PYTHON=/usr/bin/python2.7

RUN apk add --no-cache g++ git libpcap-dev make nodejs nodejs-npm python2 tar wget  \
  && mkdir -p /stnp/plugins \
  && wget -O - https://github.com/${repo}/smartthings/tarball/${branch} \
  | tar -xzvf - --wildcards --strip-components=2 -C /stnp/ ${repo}-smartthings-*/smartthings-nodeproxy/ \
  && cd /stnp \
  && rm -f restart.me smartthings-nodeproxy.service config.json \
  && npm install \
  && npm run install:dash \
  && apk del g++ git libpcap-dev make tar wget \
  && rm -rf /tmp/* 
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY config/config.json /stnp/config.json

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
