"use strict";

module.exports = (req, res) => {

    var url = req.url;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    switch(url) {
        case "/about":
            res.write('<h1>about page<h1>'); 
            break;
        case "/contact":
            res.write('<h1>contact page<h1>');
            break;
        default:
            res.write('<h1>default page<h1>'); 
            break;
      }
      res.end(); 
}