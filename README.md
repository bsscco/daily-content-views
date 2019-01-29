# daily-content-views
데일리 콘텐츠뷰 알림

### 기술 및 환경
WebStorm, Node, Express, Axios, GCP Compute Engine, crontab, Slack API

### 프로그램이 죽어도 재실행 되게 만들기
```
$ chmod 777 chkproc.sh
$ crontab -e
$ * * * * * /home/bsscco/daily-content-views/chkproc.sh > /home/bsscco/daily-content-views/crontab-chkproc.log 2>&1
```

### crontab 예약
```
$ crontab -e
$ 0 9 3 * * curl localhost:15000/notify/yesterday/contentviews > /home/bsscco/daily-content-views/crontab-curl-1.log 2>&1
```

### low memory 머신에서 npm install
```
curl -o npm-f3-install.sh https://gist.githubusercontent.com/SuperPaintman/851b330c08b2363aea1c870f0cc1ea5a/raw/4d3e792c6a54def095f451eeedc50d33ae361339/npm-f3-install.sh
sudo chmod +x npm-f3-install.sh
./npm-f3-install.sh
```