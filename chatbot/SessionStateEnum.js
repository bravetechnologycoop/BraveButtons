'use strict';

const STATES = {
    STARTED: "Started",
    WAITING_FOR_REPLY: "Waiting for reply",
    WAITING_FOR_CATEGORY: "Waiting for incident category",
    WAITING_FOR_DETAILS: "Waiting for incident details",
    COMPLETED: "Completed", 
    TIMED_OUT: "Timed out"
  };

module.exports =
        Object.freeze(STATES); 