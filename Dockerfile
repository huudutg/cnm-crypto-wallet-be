FROM node:14.15.4-stretch

COPY ./package.json /src/
WORKDIR /src
RUN npm install
COPY . /src
EXPOSE 5000
# RUN node ./bin/www
# RUN chmod +x entrypoint.sh
ENTRYPOINT ["npm", "start"]