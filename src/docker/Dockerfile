FROM debian:jessie

# Maintainer
MAINTAINER Steffen Drüsedow <steffen.druesedow@telekom.de>

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update -y \
    && apt-get upgrade -y \
    && apt-get install -y \
    curl git \
    && apt-get clean

COPY input/start.sh /start.sh
RUN chmod a+x /start.sh

# startup configuration
ENTRYPOINT ["/start-rethink.sh"]
CMD ["start"]
EXPOSE 8448
VOLUME ["/data"]


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
