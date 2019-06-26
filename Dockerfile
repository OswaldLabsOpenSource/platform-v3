# Node.js app Docker file

FROM ubuntu:14.04
MAINTAINER Thom Nichols "thom@thomnichols.org"

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update
RUN apt-get -qq update
RUN apt-get install -y nodejs npm
# TODO could uninstall some build dependencies

# fucking debian installs `node` as `nodejs`
RUN update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

VOLUME ["/data"]

ADD . /data
RUN cd /data && npm install

ENV NODE_ENV production
ENV PORT 80
EXPOSE 80

WORKDIR /data

CMD ["npm", "start"]
