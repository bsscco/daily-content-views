console.log(new Date().toTimeString());

const fs = require('fs');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
const queries = require('./db-queries');

const serviceAccount = require(__dirname + "/firebase-service-account.json");
const firebase = require('firebase-admin');

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://ohouse-android.firebaseio.com"
});

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
    res.status(200).send('Hello, DailyContentViews!').end();
});

app.post('/contents', (req, res) => {
    console.log(req.body);
    res.send('');

    if (req.body.text === 'goal') {
        getDbContentViews()
            .then(snapshot => openDlg(req.body.trigger_id, makeGoalSettingDlgPayload(snapshot.val())))
            .then(res => console.log(res.data))
            .catch(err => console.log(err));
    }
});

app.post('/interact', (req, res) => {
    console.log(req.body);
    res.send('');

    const body = JSON.parse(req.body.payload);
    if (body.callback_id === 'save_goal') {
        const date = moment({y: Number(body.submission.year), M: Number(body.submission.month) - 1}).format('YYYY-MM');

        saveGoalData(date, body.submission.goal, body.submission.goal_per_person)
            .then(res => sendMsg(body.response_url, makeGoalSavedMsgPayload(date, body.submission.goal, body.submission.goal_per_person)))
            .then(res => console.log(res.data))
            .catch(err => console.log(err));
    }
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
    const signInCnts = {
        yesterday: 0,
        lastWeekYesterday: 0,
        thisWeek: 0,
        lastWeek: 0,
        toYesterdayFor7Days: 0,
        thisMonth: 0,
        lastMonth: 0,
    }
    const contentViewCnts = {
        yesterday: 0,
        lastWeekYesterday: 0,
        thisWeek: 0,
        lastWeek: 0,
        toYesterdayFor7Days: 0,
        thisMonth: 0,
        lastMonth: 0,
        thisMonthGoal: 0,
        thisMonthGoalPerPerson: 0,
    }
    const db = pgp({
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.pwd
    });
    getDbContentViews(yesterday.format('YYYY-MM'))
        .then(snapshot => {
            contentViewCnts.thisMonthGoal = parseFloat(snapshot.val().goal);
            contentViewCnts.thisMonthGoalPerPerson = parseFloat(snapshot.val().goal_per_person);
            return db.any(queries.getSignInCnt(dates.yesterday, dates.today));
        })
        .then((rows) => {
            signInCnts.yesterday = parseInt(rows[0].cnt);
            return db.any(queries.getSignInCnt(dates.lastWeekYesterday, dates.lastWeekToday));
        })
        .then((rows) => {
            signInCnts.lastWeekYesterday = parseInt(rows[0].cnt);
            return db.any(queries.getSignInCnt(moment(dates.yesterday).startOf('week'), dates.today));
        })
        .then((rows) => {
            signInCnts.thisWeek = parseInt(rows[0].cnt);
            return db.any(queries.getSignInCnt(moment(dates.lastWeekYesterday).startOf('week'), dates.lastWeekToday));
        })
        .then((rows) => {
            signInCnts.lastWeek = parseInt(rows[0].cnt);
            return db.any(queries.getSignInCnt(moment(dates.today).subtract(7, 'days'), moment(dates.today)));
        })
        .then((rows) => {
            signInCnts.toYesterdayFor7Days = parseInt(rows[0].cnt);
            return db.any(queries.getSignInCnt(moment(dates.yesterday).startOf('month'), dates.today));
        })
        .then((rows) => {
            signInCnts.thisMonth = parseInt(rows[0].cnt);
            return db.any(queries.getSignInCnt(moment(dates.yesterday).subtract(1, 'months').startOf('month'), moment(yesterday).subtract(1, 'months').endOf('month').add(1, 'days')));
        })
        .then((rows) => {
            signInCnts.lastMonth = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(dates.yesterday, dates.today));
        })
        .then((rows) => {
            contentViewCnts.yesterday = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(dates.lastWeekYesterday, dates.lastWeekToday));
        })
        .then((rows) => {
            contentViewCnts.lastWeekYesterday = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(moment(dates.yesterday).startOf('week'), dates.today));
        })
        .then((rows) => {
            contentViewCnts.thisWeek = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(moment(dates.lastWeekYesterday).startOf('week'), dates.lastWeekToday));
        })
        .then((rows) => {
            contentViewCnts.lastWeek = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(moment(dates.today).subtract(7, 'days'), moment(dates.today)));
        })
        .then((rows) => {
            contentViewCnts.toYesterdayFor7Days = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(moment(dates.yesterday).startOf('month'), dates.today));
        })
        .then((rows) => {
            contentViewCnts.thisMonth = parseInt(rows[0].cnt);
            return db.any(queries.getContentViewCnt(moment(dates.yesterday).subtract(1, 'months').startOf('month'), moment(yesterday).subtract(1, 'months').endOf('month').add(1, 'days')));
        })
        .then((rows) => contentViewCnts.lastMonth = parseInt(rows[0].cnt))
        .then(() => sendMsg('', makeNotiMsgPayload(dates, signInCnts, contentViewCnts)))
        .then(res => console.log(res.data))
        .catch((e) => console.log(e.message));
});

function getDbContentViews(date) {
    let path = '/daily-content-views';
    if (date) {
        path += '/' + date;
    }
    return firebase.database().ref(path).once('value');
}

function saveGoalData(date, goal, goalPerPerson) {
    return firebase.database().ref('/daily-content-views/' + date).update({goal: goal, goal_per_person: goalPerPerson});
}

function makeGoalSettingDlgPayload(monthlyGoals) {
    const elements = [];

    let monthlyGoalsText = '';
    for (const date in monthlyGoals) {
        monthlyGoalsText += date + ' : ' + monthlyGoals[date].goal + '회 (사용자당 ' + monthlyGoals[date].goal_per_person + '회)\n';
    }
    elements.push({
        type: 'textarea',
        label: '설정된 목표들(참고용)',
        name: 'none',
        hint: '참고용입니다. 여기서 수정해도 저장되지 않습니다.',
        value: monthlyGoalsText,
        optional: true
    });

    const years = [];
    for (let y = 2019; y <= moment().year() + 1; y++) {
        years.push({label: '' + y, value: '' + y});
    }
    elements.push({
        type: 'select',
        label: '년',
        name: 'year',
        value: '' + moment().year(),
        options: years,
        subtype: 'number',
        optional: false,
    });

    const months = [];
    for (let m = 1; m <= 12; m++) {
        months.push({label: '' + m, value: '' + m});
    }
    elements.push({
        type: 'select',
        label: '월',
        name: 'month',
        value: '' + (moment().month() + 1),
        options: months,
        subtype: 'number',
        optional: false
    });

    elements.push({
        type: 'text',
        label: '조회수 목표',
        name: 'goal',
        placeholder: 'ex) 20000000',
        value: '',
        subtype: 'number',
        optional: false
    });

    elements.push({
        type: 'text',
        label: '사용자당 조회수 목표',
        name: 'goal_per_person',
        placeholder: 'ex) 1.2',
        value: '',
        subtype: 'number',
        optional: false
    });

    return {
        callback_id: 'save_goal',
        title: '콘텐츠 조회수 목표 설정',
        submit_label: '저장',
        elements: elements
    };
}

function makeGoalSavedMsgPayload(date, goal, goalPerPerson) {
    return {
        attachments: [
            {
                title: date + ' 설정된 목표',
                text: goal + '회 (사용자당 ' + goalPerPerson + '회)',
                color: '#35c5f0'
            }
        ]
    };
}

function makeNotiMsgPayload(dates, signInCnts, contentViewCnts) {
    const yesterdayIncrRate = (contentViewCnts.yesterday - contentViewCnts.lastWeekYesterday) / contentViewCnts.lastWeekYesterday * 100;
    const yesterdayPerPerson = contentViewCnts.yesterday / signInCnts.yesterday;
    const lastWeekYesterdayPerPerson = contentViewCnts.lastWeekYesterday / signInCnts.lastWeekYesterday;
    const yesterdayIncrRatePerPerson = (yesterdayPerPerson - lastWeekYesterdayPerPerson) / lastWeekYesterdayPerPerson * 100;

    // const thisWeekIncrRate = (contentViewCnts.thisWeek - contentViewCnts.lastWeek) / contentViewCnts.lastWeek * 100;
    // const thisWeekPerPerson = contentViewCnts.thisWeek / signInCnts.thisWeek;
    // const lastWeekPerPerson = contentViewCnts.lastWeek / signInCnts.lastWeek;
    // const thisWeekIncrRatePerPerson = (thisWeekPerPerson - lastWeekPerPerson) / lastWeekPerPerson * 100;

    const thisMonthIncrRate = (contentViewCnts.thisMonth - contentViewCnts.lastMonth) / contentViewCnts.lastMonth * 100;
    const thisMonthPerPerson = contentViewCnts.thisMonth / signInCnts.thisMonth;
    const lastMonthPerPerson = contentViewCnts.lastMonth / signInCnts.lastMonth;
    const thisMonthIncrRatePerPerson = (thisMonthPerPerson - lastMonthPerPerson) / lastMonthPerPerson * 100;

    let thisMonthExpected = 0;
    if (dates.yesterday.date() < 7) {
        thisMonthExpected = contentViewCnts.toYesterdayFor7Days / 7 * dates.yesterday.daysInMonth();
    } else {
        thisMonthExpected = contentViewCnts.thisMonth / dates.yesterday.date() * dates.yesterday.daysInMonth();
    }
    thisMonthExpected = Math.round(thisMonthExpected);

    let thisMonthExpectedPerPerson = 0;
    if (dates.yesterday.date() < 7) {
        thisMonthExpectedPerPerson = (contentViewCnts.toYesterdayFor7Days / signInCnts.toYesterdayFor7Days) / 7 * dates.yesterday.daysInMonth();
    } else {
        thisMonthExpectedPerPerson = (contentViewCnts.thisMonth / signInCnts.thisMonth) / dates.yesterday.date() * dates.yesterday.daysInMonth();
    }
    thisMonthExpectedPerPerson = Math.round(thisMonthExpectedPerPerson);

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
                        value: numberFormat('#,##0.', contentViewCnts.yesterday) + '회 (지난 주 대비 ' + (yesterdayIncrRate >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(yesterdayIncrRate)) + ')'
                        + '\n사용자당 ' + numberFormat('#,##0.0', yesterdayPerPerson) + '회 (지난 주 대비 ' + (yesterdayIncrRatePerPerson >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(yesterdayIncrRatePerPerson)) + ')',
                        short: true
                    }
                ]
            },
            // {
            //     title: '주간',
            //     color: '#35c5f0',
            //     id: 2,
            //     text: '',
            //     fields: [
            //         {
            //             title: moment(dates.yesterday).startOf('week').format('MM/DD(ddd)') + ' ~ 어제까지',
            //             value: numberFormat('#,##0.', contentViewCnts.thisWeek) + '회 (지난 주 대비 ' + (thisWeekIncrRate >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(thisWeekIncrRate)) + ')'
            //             + '\n사용자당 ' + numberFormat('#,##0.0', thisWeekPerPerson) + '회 (지난 주 대비 ' + (thisWeekIncrRatePerPerson >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(thisWeekIncrRatePerPerson)) + ')',
            //             short: false
            //         }
            //     ]
            // },
            {
                title: '월간',
                color: '#35c5f0',
                id: 3,
                text: '',
                fields: [
                    {
                        title: moment(dates.yesterday).startOf('month').format('MM/DD(ddd)') + ' ~ 어제까지',
                        value: numberFormat('#,##0.', contentViewCnts.thisMonth) + '회 (지난 월 대비 ' + (thisMonthIncrRate >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(thisMonthIncrRate)) + ')'
                        + '\n사용자당 ' + numberFormat('#,##0.0', thisMonthPerPerson) + '회 (지난 월 대비 ' + (thisMonthIncrRatePerPerson >= 0 ? '▲' : '▼') + numberFormat('#,##0.##%', Math.abs(thisMonthIncrRatePerPerson)) + ')',
                        short: true
                    },
                    // {
                    //     title: dates.yesterday.format('MM월') + ' 예상',
                    //     value: numberFormat('#,##0.', thisMonthExpected) + '회 (목표 ' + numberFormat('#,##0.', contentViewCnts.thisMonthGoal) + '회)\n*`' + numberFormat('#,##0.', Math.abs(contentViewCnts.thisMonthGoal - thisMonthExpected)) + '회' + (contentViewCnts.thisMonthGoal - thisMonthExpected >= 0 ? ' 더 필요' : ' 초과달성') + '`*'
                    //     + '\n사용자당 ' + numberFormat('#,##0.0', thisMonthExpectedPerPerson) + '회 (목표 ' + numberFormat('#,##0.0', contentViewCnts.thisMonthGoalPerPerson) + '회)\n*`' + '사용자당 ' + numberFormat('#,##0.0', Math.abs(contentViewCnts.thisMonthGoalPerPerson - thisMonthExpectedPerPerson)) + '회' + (contentViewCnts.thisMonthGoalPerPerson - thisMonthExpectedPerPerson >= 0 ? ' 더 필요' : ' 초과달성') + '`*',
                    //     short: true
                    // },
                    {
                        title: dates.yesterday.format('MM월') + ' 목표',
                        value: numberFormat('#,##0.', contentViewCnts.thisMonthGoal) + '회\n사용자당 ' + numberFormat('#,##0.0', contentViewCnts.thisMonthGoalPerPerson) + '회',
                        short: true
                    },
                ]
            }
        ]
    };
    return json;
}

function openDlg(triggerId, payload) {
    return axios.post('https://slack.com/api/dialog.open', JSON.stringify({
            trigger_id: triggerId,
            dialog: JSON.stringify(payload)
        }), {
            headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + config.slack.bot_access_token}
        }
    );
}

function sendMsg(responseUrl, payload) {
    return axios.post(responseUrl ? responseUrl : 'https://slack.com/api/chat.postMessage', JSON.stringify(payload), {
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + config.slack.bot_access_token}
    });
}


// Start the server
const PORT = process.env.PORT || 15000;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});