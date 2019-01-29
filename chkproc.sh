daemon=`netstat -tlnp | grep :::15000 | wc -l`
if [ "$daemon" -eq "0" ] ; then
        nohup node /home/bsscco/daily-content-views/app.js &
fi