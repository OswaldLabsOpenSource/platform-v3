FROM node:10.16.0-alpine
RUN apk add --no-cache udev ttf-freefont chromium git
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY ./package.json /usr/src/app/
RUN npm install && npm cache clean --force
COPY ./ /usr/src/app
ENV NODE_ENV production
ENV PORT 80
EXPOSE 80
RUN ["npm", "run", "build"]
CMD ["npm", "run", "launch"]
