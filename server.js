const express = require('express');
const axios = require('axios');
const app = express();
const path= require('path');
const connection = require('./sql-config.js');
const env = require('dotenv').config();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

async function qrgererator(shortlink)
{     
    const data = {
        workspace: '132e744b-fb1c-4d27-bc70-4924c70aca4f',
        qr_data: `${shortlink}`,
        primary_color: '#ffffff',
        pattern: 'Circles',
        eye_style: 'Rounded',
        generate_png: true,
        frame: 'polkadot'
    };
    try 
    {
        const response = await axios.post('https://hovercode.com/api/v2/hovercode/create/', data, {
            headers: {     Authorization: `Token ${process.env.API_KEY}`        },
            timeout: 10000
        });
        return response.data.png;
    } 
    catch (error) {      console.error("Qr not generated");    }
}

app.get('/', async (req, res) => 
{
    let {link, url} = req.query;
    // console.log(link,url);

    let qrurl = "";
    if(link != "")  qrurl = await qrgererator(link);
    res.render('index.ejs', {link: link, url: url, qrurl: qrurl});
});

const randomString = "1234567890@^&_qwertyuiopasdfghjklzxcvbnm";

function generateshortlink() 
{
    let shortlink = '';
    for (let i = 0; i < 3; i++) 
    {
        const randomIndex = Math.floor(Math.random() * randomString.length);
        shortlink += randomString[randomIndex];
    }
    connection.query(`SELECT url FROM URLTABLE WHERE shortlink = $1`, [shortlink], function (err, results, fields) {if (results.rowCount <= 0)    return generateshortlink();
    });
    return shortlink;    
}
app.post('/shorten', (req, res) => 
{
    let url  = req.body.url;
    let link="";
    if(!url || url.trim() =='')    res.redirect(`/?link=${encodeURIComponent(link)}&url=${encodeURIComponent(url)}`);
    connection.query(`SELECT shortlink FROM URLTABLE WHERE url = $1`, [url], function (err, results) 
    {
        if(results.rowCount > 0) 
        {
            link = results.rows[0].shortlink;
            link = req.headers.origin + '/' + link;
            res.redirect(`/?link=${encodeURIComponent(link)}&url=${encodeURIComponent(url)}`);
        }
        else
        {
            link = generateshortlink();
            const insertQuery = `INSERT INTO urltable (url, shortlink) VALUES ($1, $2)`;
            const values = [url, link];
            connection.query(insertQuery, values, function (err, results) {
                if (err) {
                    res.status(500).send('Database query failed');
                    return;
                }
                link = req.headers.origin + '/' + link;
                res.redirect(`/?link=${encodeURIComponent(link)}&url=${encodeURIComponent(url)}`);
            });
        }
    });
});

app.get('/:s', (req, res) => 
{
    let shortlink = req.params.s;
    connection.query(`SELECT url FROM URLTABLE WHERE shortlink = $1`, [shortlink], function (err, results, fields) {
        if (results.rowCount > 0) 
        {
            const url = results.rows[0].url;
            res.redirect(url);
        } 
        else  res.sendStatus(404);
    });
});

app.post('/curtomurl', async (req, res) => 
{
    let link = req.body.link;
    let url = req.body.url;
    connection.query(`SELECT url FROM URLTABLE WHERE shortlink = $1`, [link], function (err, results, fields) 
    {
        if (results.rowCount <= 0)
        {    
            const insertQuery = `INSERT INTO urltable (url, shortlink) VALUES ($1, $2)`;
            const values = [url, link];
            connection.query(insertQuery, values, function (err, results) {
                if (err) {  res.status(500).send('Database query failed'); return; }
            });
            link = req.headers.origin + '/' + link;
            // console.log(link,url,"redirecting");
            res.send(`/?link=${encodeURIComponent(link)}&url=${encodeURIComponent(url)}`);
        }
        else    res.send('false');
    });
});

app.listen(process.env.PORT, () => { console.log('Server is running...') });
