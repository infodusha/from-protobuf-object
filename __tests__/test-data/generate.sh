#!/bin/bash

cd ./__tests__/test-data

OUT_DIR=./generated

mkdir -p $OUT_DIR

gen () {
  protoc --plugin=protoc-gen-grpc-web=../../node_modules/.bin/protoc-gen-grpc-web --js_out="import_style=commonjs,binary:$OUT_DIR" --grpc-web_out="import_style=typescript,mode=grpcweb:$OUT_DIR" $1
  echo "Generated $1"
}

gen ./book-store.proto
gen ./phone-shop.proto
gen ./forest.proto
gen ./universe.proto
gen ./spices.proto
gen ./newspaper.proto
gen ./file.proto
