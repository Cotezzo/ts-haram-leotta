FROM node:16.13.2
WORKDIR /usr/src/app
COPY *.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
