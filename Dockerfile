FROM node:16.6.1
WORKDIR /usr/src/app
COPY *.json ./
RUN npm install
COPY . .
CMD [ "npm", "start"]
