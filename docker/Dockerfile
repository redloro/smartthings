FROM resin/rpi-raspbian:jessie

ARG architecture=armv6
ARG node_version=6.11.1
ARG build_date
ARG repo=redloro
ARG branch=master

LABEL org.label-schema.schema-version="1.0" \
      org.label-schema.name="rpi-smartthings-nodeproxy" \
      org.label-schema.description="SmartThings Node Proxy for Raspberry Pi" \
      org.label-schema.version="1.0.2" \
      org.label-schema.docker.cmd="docker run -d -p 8080:8080 -e ENABLED_PLUGINS='' --device=/dev/ttyUSB0 rpi-smartthings-nodeproxy" \
      org.label-schema.build-date=$build_date \
      architecture=$architecture

RUN apt-get update \
 && apt-get install wget \
 && apt-get clean \
 && wget -O - https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-${architecture}l.tar.xz \
  | tar -xJvf - --strip-components=1 -C /usr/local/ \
 && apt-get remove --auto-remove wget --purge \
 && rm -rf /tmp/* 

ENV NODE=/usr/local/bin/node
ENV NPM=/usr/local/bin/npm
ENV PYTHON=/usr/bin/python2.7

RUN apt-get install python2.7 build-essential libpcap-dev wget \
 && mkdir -p /stnp/plugins \
 && wget -O - https://github.com/${repo}/smartthings/tarball/${branch} \
  | tar -xzvf - --wildcards --strip-components=2 -C /stnp/ ${repo}-smartthings-*/smartthings-nodeproxy/ \
 && cd /stnp \
 && rm -f restart.me smartthings-nodeproxy.service config.json \
 && npm install \
 && npm install serialport@4.0.7 \
 && npm install https://github.com/node-pcap/node_pcap/tarball/master \
 && apt-get remove --auto-remove wget build-essential libpcap-dev libpcap0.8-dev --purge \
 && apt-get clean \
 && rm -rf /tmp/* 

COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY config.sample /stnp/config.json

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]

