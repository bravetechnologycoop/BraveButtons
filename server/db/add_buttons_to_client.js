// this file is only here so there are no merge conflicts when i merge from main

const fs = require('fs');
const { Client } = require('pg');
const csv = require('csv-parser');

// FIXME: envContent can be changed to match the other functions better
// FIXME: i cant test this without my other code
async function processButtons(req, res) {
    try {
      if (!req.session.user || !req.cookies.user_sid) {
        res.status(401).send('Unauthorized');
        return;
      }
  
      const clientName = req.body.clientName;
      const csvFile = req.file; // Assuming the CSV file is uploaded as a file
  
      const pgClient = await db.beginTransaction();
  
      try {
        const resClient = await db.getClientByName(pgClient, clientName);
  
        if (resClient.rows.length === 0) {
          res.status(404).send(`Couldn't find a client with the given client name ${clientName}`);
          await db.rollbackTransaction(pgClient);
          return;
        }
  
        const clientId = resClient.rows[0].id;
  
        await db.insertDevicesFromCsv(csvFile, clientId, pgClient);
  
        await db.commitTransaction(pgClient);
        res.status(200).send('CSV processing complete.');
      } catch (error) {
        await db.rollbackTransaction(pgClient);
        throw error;
      }
    } catch (error) {
      res.status(500).send(`Error occurred: ${error.message}`);
    }
  }

  // TODO: still need to write all the helper functions on db.js