FROM silviof/docker-matrix

# Maintainer
MAINTAINER Steffen Drüsedow <steffen.druesedow@telekom.de>

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update -y \
    && apt-get upgrade -y \
    && apt-get install -y \
    curl \
    && apt-get clean

COPY input/start-rethink.sh /start-rethink.sh
RUN chmod a+x /start-rethink.sh

# startup configuration
ENTRYPOINT ["/start-rethink.sh"]
CMD ["start"]
EXPOSE 8448
VOLUME ["/data"]


# add nodejs repo
RUN curl -sL https://deb.nodesource.com/setup_5.x | bash -

RUN apt-get install -y nodejs
