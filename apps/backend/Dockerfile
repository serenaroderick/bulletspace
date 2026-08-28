FROM alpine:3.20

ARG POCKETBASE_VERSION=0.28.0

RUN apk add --no-cache unzip ca-certificates && \
    wget "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip" \
      -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip

WORKDIR /pb
COPY pb_migrations ./pb_migrations

EXPOSE 8080
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb/pb_data"]
