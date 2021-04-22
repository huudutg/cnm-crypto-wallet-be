
module.exports = function (app) {
    app.use('/info', require('../routes/user/info.route'));
    //     app.use('/host',require('../routes/user/host.route'));
    //     app.use('/room', require('../routes/room/room.route'));
    //     app.use('/admin', require('../routes/admin/admin.route'));
};