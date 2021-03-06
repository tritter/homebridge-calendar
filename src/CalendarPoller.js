'use strict';

const EventEmitter = require('events').EventEmitter;
const IcalExpander = require('ical-expander');
const https = require('https');

class CalendarPoller extends EventEmitter {

  constructor(log, name, url, interval) {
    super();

    this.log = log;
    this.name = name;

    this._url = url.replace('webcal://', 'https://');
    this._interval = interval;
    this._isStarted = false;
  }

  start() {
    if (this._isStarted === false) {
      this.emit('started');
      this._isStarted = true;
      this._loadCalendar();
    }
  }

  stop() {
    if (this._isStarted === true) {
      this.emit('stopped');
      this._isStarted = false;

      clearTimeout(this._refreshTimer);
      this._refreshTimer = undefined;
    }
  }

  _loadCalendar() {
    // TODO: Make use of HTTP cache control stuff
    this.log(`Updating calendar ${this.name}`);

    https.get(this._url, (resp) => {

      resp.setEncoding('utf8');
      let data = '';
  
      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });
  
      // The whole response has been received. 
      resp.on('end', () => {
        this._refreshCalendar(data);
      });
  
    }).on('error', (err) => {

      if (err) {
        this.log(`Failed to load iCal calender: ${this.url} with error ${err}`);
        this.emit('error', err);
      }

    });
  }

  _refreshCalendar(data) {

    const icalExpander = new IcalExpander({
      ics: data,
      maxIterations: 1000
    });

    const days = 7;
    const duration = days * 24 * 60 * 60 * 1000;

    var now = new Date();
    var prev = new Date(now.getTime() - duration);
    var next = new Date(now.getTime() + duration);

    const cal = icalExpander.between(prev, next);

    if (cal) {
      this.emit('data', cal);
    }

    this._scheduleNextIteration();
  }

  _scheduleNextIteration() {
    if (this._refreshTimer !== undefined || this._isStarted === false) {
      return;
    }

    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = undefined;
      this._loadCalendar();
    }, this._interval);
  }

}

module.exports = CalendarPoller;