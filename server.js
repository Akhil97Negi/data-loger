import express from 'express';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import { config } from 'dotenv';
import { Data} from './model/datamodel.js';
import connectToDB from './config/db.js';
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const URL = process.env.URL || null;


function log(level, message) {
    const logMessage = `${new Date().toISOString()} [${level.toUpperCase()}] - ${message}\n`;
    fs.appendFileSync(path.join(__dirname, `logs/${level.toLowerCase()}.log`), logMessage);
    console.log(logMessage);
}
const logDirectory = path.join(__dirname, 'logs');

const app = express();

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// DashBoard 
app.get('/', (req, res) => {
    const level = req.query.level ? req.query.level.toUpperCase() : 'INFO';
    const logFilePath = path.join(__dirname, `logs/${level.toLowerCase()}.log`);
    let filteredLogs = [];

    if (fs.existsSync(logFilePath)) {
        const logFile = fs.readFileSync(logFilePath, 'utf-8');
        filteredLogs = logFile.split('\n').filter(log => log.includes(level));
    }

    res.send(`
    <h1>Dashboard Running Live</h1>
    <form method="get" style="margin-bottom: 40px;">
      <label for="level">Logs Type</label>
      <select id="level" name="level" onchange="this.form.submit()">
        <option style="color : blue" value="INFO" ${level === 'INFO' ? 'selected' : ''}>INFO</option>
        <option style="color : yellow" value="WARN" ${level === 'WARN' ? 'selected' : ''}>WARN</option>
        <option style="color :  red"  value="ERROR" ${level === 'ERROR' ? 'selected' : ''}>ERROR</option>
        <option style="color : green" value="SUCCESS" ${level === 'SUCCESS' ? 'selected' : ''}>SUCCESS</option>
      </select>
    </form>
    <pre>${filteredLogs.join('\n')}</pre>
  `);
});

// Function to process data in chunks
async function processChunks(dataArray, chunkSize) {
    for (let i = 0; i < dataArray.length; i += chunkSize) {
        const chunk = dataArray.slice(i, i + chunkSize);
        log('info', `Processing chunk: ${i / chunkSize + 1} / ${Math.ceil(dataArray.length / chunkSize)}`);

        const promises = chunk.map(async (data) => {
            try {
                const existingEntry = await Data.findOne({ id: data.id });
                if (!existingEntry) {
                    await Data.create(data);
                    log('success', `New entry added: ${JSON.stringify(data)}`);
                } else {
                    await Entry.updateOne({ id: data.id }, data);
                    log('success', `Existing entry updated: ${JSON.stringify(data)}`);
                }
            } catch (error) {
                log('error', `Error processing data: ${JSON.stringify(data)}, Error: ${error}`);
            }
        });

        await Promise.all(promises);
    }
}

// Update data 
async function readFileAndUpload() {
    const filePath = path.join(__dirname, "./MOCK.json");
    if (!fs.existsSync(filePath)) {
        log('error', `Data file not found: ${filePath}`);
        return;
    }

    let rawData;
    try {
        rawData = fs.readFileSync(filePath, 'utf-8');
        log('info', `Read data from file: ${filePath}`);
    } catch (error) {
        log('error', `Failed to read file: ${filePath}, Error: ${error}`);
        return;
    }

    let dataArray;
    try {
        dataArray = JSON.parse(rawData);
        log('info', `Parsed data successfully from file: ${filePath}`);
    } catch (error) {
        log('error', `Failed to parse data from file: ${filePath}, Error: ${error}`);
        return;
    }

    await processChunks(dataArray, 10);
}

cron.schedule('0 0,12 * * *', () => {
    log('info', 'Running scheduled task');
    readFileAndUpload().catch(err => log('error', `Error in task: ${err}`));
});


app.listen(PORT, async () => {
    try {
       await connectToDB(URL);
   console.log(`Server is running on port ${PORT}`);
    } catch (error) {
       console.log(error);
    }
});
