require('dotenv').config();
const nodemailer = require('nodemailer');
const nodecron = require('node-cron');
const mysql2 = require('mysql2/promise');
const { Parser } = require('json2csv');
const fs = require('fs');
const moment = require('moment');

// email yang akan dikirim
const { emailTo } = require('./config');

async function main() {
  if (emailTo.length < 1) {
    console.log('Email yang akan dikirim harus diisi');
    return;
  }

  console.log('Connecting to database');
  const connection = await mysql2.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  console.log('Database connected:', connection.threadId);

  // mail options
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
    to: emailTo,
    subject: process.env.MAIL_SUBJECT,
  };

  // mail transporter
  const transporter = nodemailer.createTransport({
    service: process.env.MAIL_DRIVER,
    port: process.env.MAIL_PORT,
    host: process.env.MAIL_HOST,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  // START: CRON
  nodecron.schedule('0 0 0 * * *', async () => {
    const start = moment().format('YYYY-MM-DD HH:mm:ss');
    console.log('====================================');
    console.log('Start schedule:', start);

    const [rows] = await connection.execute(
      'SELECT name, ending_balance, priceplan_name, markup FROM stores'
    );
    const fields = ['name', 'ending_balance', 'priceplan_name', 'markup'];

    const date = moment().format('YYYY_MM_DD_HH_mm_ss');
    const filename = 'report_endball_customer_' + date + '.csv';
    const pathname = 'files/' + filename;
    const options = { fields };

    try {
      const parser = new Parser(options);
      const csv = parser.parse(rows);

      fs.writeFile(pathname, csv, (error) => {
        if (error) {
          console.log('Error: create new file to "' + pathname + '"');
          console.log(error);
        } else {
          console.log('CSV file saved!');

          mailOptions.attachments = [
            {
              filename: filename,
              path: pathname,
            },
          ];

          console.log('Start send email');
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log('Error: sent email');
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);

              const end = moment().format('YYYY-MM-DD HH:mm:ss');
              console.log('End schedule:', end);
            }
          });
        }
      });
    } catch (error) {
      console.log('Error: convert to CSV');
      console.log(error);
    }
  });
  //   END: CRON
}

main();
