FROM debian:jessie

# Maintainer
MAINTAINER Steffen Drüsedow <steffen.druesedow@telekom.de>

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update -y \
    && apt-get upgrade -y \
    && apt-get install -y \
    curl git \
    && apt-get clean

# add nodejs repo
RUN curl -sL https://deb.nodesource.com/setup_5.x | bash -

RUN apt-get install -y nodejs

RUN mkdir -p /opt/rethink && cd /opt/rethink
RUN cd /opt/rethink \
  && git clone https://github.com/reTHINK-project/dev-msg-node-nomatrix.git
RUN cd /opt/rethink/dev-msg-node-nomatrix \
  && npm install \
  && npm install gulp --global \
  && gulp dist

# startup configuration
EXPOSE 2701
WORKDIR /opt/rethink/dev-msg-node-nomatrix
ENTRYPOINT ["/usr/bin/npm", "start"]
