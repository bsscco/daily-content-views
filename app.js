console.log(new Date().toTimeString());

const fs = require('fs');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
const queries = require('./db-queries');

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const moment = require('moment');
const numberFormat = require('number-formatter');

const pgp = require('pg-promise')();

const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.status(200).send('Hello, DailyUsers!').end();
});

app.get('/notify/yesterday/contentviews', (req, res) => {
    res.sendStatus(200);

    const today = moment();
    const yesterday = moment(today).subtract(1, 'days');
    // const today = moment({y: 2018, M: Number(process.argv[2]), d: date}).add(1, 'days');
    const dates = {
        today,
        yesterday,
        lastWeekToday: moment(today).subtract(7, 'days'),
        lastWeekYesterday: moment(yesterday).subtract(7, 'days'),
    }
    const signInCnts = {yesterday: 0, lastWeekYesterday: 0, thisWeek: 0, lastWeek: 0, thisMonth: 0, lastMonth: 0}
    const contentViewCnts = {yesterday: 0, lastWeekYesterday: 0, thisWeek: 0, lastWeek: 0, thisMonth: 0, lastMonth: 0}
    const db = pgp({
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.pwd
    });
    db
        .any(queries.getSignInCnt(dates.yesterday, dates.today))
        .then((rows) => {
            signInCnts.yesterday = rows[0].cnt;
            return db.any(queries.getSignInCnt(dates.lastWeekYesterday, dates.lastWeekToday));
        })
        .then((rows) => {
            signInCnts.lastWeekYesterday = rows[0].cnt;
            return db.any(queries.getSignInCnt(moment(dates.yesterday).startOf('week'), dates.today));
        })
        .then((rows) => {
            signInCnts.thisWeek = rows[0].cnt;
            return db.any(queries.getSignInCnt(moment(dates.lastWeekYesterday).startOf('week'), dates.lastWeekToday));
        })
        .then((rows) => {
            signInCnts.lastWeek = rows[0].cnt;
            return db.any(queries.getSignInCnt(moment(dates.yesterday).startOf('month'), dates.today));
        })
        .then((rows) => {
            signInCnts.thisMonth = rows[0].cnt;
            return db.any(queries.getSignInCnt(moment(dates.yesterday).subtract(1, 'months').startOf('month'), moment(dates.yesterday).startOf('month')));
        })
        .then((rows)=>{
            signInCnts.lastMonth = rows[0].cnt;
            return db.any(queries.getContentViewCnt(dates.yesterday, dates.today));
        })
        .then((rows) => {
            contentViewCnts.yesterday = rows[0].cnt;
            return db.any(queries.getContentViewCnt(dates.lastWeekYesterday, dates.lastWeekToday));
        })
        .then((rows) => {
            contentViewCnts.lastWeekYesterday = rows[0].cnt;
            return db.any(queries.getContentViewCnt(moment(dates.yesterday).startOf('week'), dates.today));
        })
        .then((rows) => {
            contentViewCnts.thisWeek = rows[0].cnt;
            return db.any(queries.getContentViewCnt(moment(dates.lastWeekYesterday).startOf('week'), dates.lastWeekToday));
        })
        .then((rows) => {
            contentViewCnts.lastWeek = rows[0].cnt;
            return db.any(queries.getContentViewCnt(moment(dates.yesterday).startOf('month'), dates.today));
        })
        .then((rows) => {
            contentViewCnts.thisMonth = rows[0].cnt;
            return db.any(queries.getContentViewCnt(moment(dates.yesterday).subtract(1, 'months').startOf('month'), moment(dates.yesterday).startOf('month')));
        })
        .then((rows) => {
            contentViewCnts.lastMonth = rows[0].cnt;
        })
        .then(() => {
            return sendMsg(makeNotiMsgPayload(dates, signInCnts, contentViewCnts));
        })
        .catch((e) => {
            console.log(e.message);
        });
});

function makeNotiMsgPayload(dates, signInCnts, contentViewCnts) {
    const yesterdayIncrRate = (contentViewCnts.yesterday - contentViewCnts.lastWeekYesterday) / contentViewCnts.lastWeekYesterday * 100;
    const yesterdayPerPerson = contentViewCnts.yesterday / signInCnts.yesterday;
    const lastWeekYesterdayPerPerson = contentViewCnts.lastWeekYesterday / signInCnts.lastWeekYesterday;
    const yesterdayIncrRatePerPerson = (yesterdayPerPerson - lastWeekYesterdayPerPerson) / lastWeekYesterdayPerPerson * 100;

    const thisWeekIncrRate = (contentViewCnts.thisWeek - contentViewCnts.lastWeek) / contentViewCnts.lastWeek * 100;
    const thisWeekPerPerson = contentViewCnts.thisWeek / signInCnts.thisWeek;
    const lastWeekPerPerson = contentViewCnts.lastWeek / signInCnts.lastWeek;
    const thisWeekIncrRatePerPerson = (thisWeekPerPerson - lastWeekPerPerson) / lastWeekPerPerson * 100;

    const thisMonthPerPerson = contentViewCnts.thisMonth / signInCnts.thisMonth;

    const json = {
        channel: config.slack.noti_channel_id,
        attachments: [                          
            {
                title: '일간',
                color: '#35c5f0',
                id: 1,
                text: '',
                fields: [
                    {
                        title: dates.yesterday.format('MM/DD(ddd)') + ' 어제',
                        value: numberFormat('#,##0.#', contentViewCnts.yesterday) + '회 조회 (지난 주 대비 ' + (yesterdayIncrRate >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(yesterdayIncrRate)) + ')'
                        + '\n사용자 1명당 ' + numberFormat('#,##0.#', yesterdayPerPerson) + '회 조회 (지난 주 대비 ' + (yesterdayIncrRatePerPerson >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(yesterdayIncrRatePerPerson)) + ')',
                        short: false
                    }
                ]
            },
            {
                title: '주간',                           
                color: '#35c5f0',
                id: 2,
                text: '',
                fields: [
                    {
                        title: moment(dates.yesterday).startOf('week').format('MM/DD(ddd)') + ' ~ 어제까지',
                        value: numberFormat('#,##0.#', contentViewCnts.thisWeek) + '회 조회 (지난 주 대비 ' + (thisWeekIncrRate >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(thisWeekIncrRate)) + ')'
                        + '\n사용자 1명당 ' + numberFormat('#,##0.#', thisWeekPerPerson) + '회 조회 (지난 주 대비 ' + (thisWeekIncrRatePerPerson >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(thisWeekIncrRatePerPerson)) + ')',
                        short: false
                    }
                ]
            },
            {
                title: '월간',
                color: '#35c5f0',
                id: 3,
                text: '',
                fields: [
                    {
                        title: moment(dates.yesterday).startOf('month').format('MM/DD(ddd)') + ' ~ 어제까지',
                        value: numberFormat('#,##0.#', contentViewCnts.thisMonth) + '회 조회'
                        + '\n사용자 1명당 ' + numberFormat('#,##0.#', thisMonthPerPerson) + '회 조회',
                        short: false
                    }
                ]
            }
        ]
    };

    return json;
}

function sendMsg(payload) {
    return axios.post('https://slack.com/api/chat.postMessage', JSON.stringify(payload), {
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + config.slack.bot_access_token
        }
    });
}


// Start the server
const PORT = process.env.PORT || 15000;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});