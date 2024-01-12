FROM node:19.8.1
WORKDIR /usr/src/app
COPY *.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
