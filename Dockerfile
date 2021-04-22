FROM node:14.15.4-stretch

COPY ./package.json /src/
WORKDIR /src
RUN npm install
COPY . /src
EXPOSE 3300
# RUN node ./bin/www
# RUN chmod +x entrypoint.sh
ENTRYPOINT ["npm", "start"]