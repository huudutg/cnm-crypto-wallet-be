const express = require("express");
const router = express.Router();
const User = require('../../model/user.model')

const me = {
    "id": "124",
    "name": "Huynh Huu Du",
    "list": [{
        "name": "facebook",
        "link": "facebook.com/huudutg"
    }, {
        "name": "mail",
        "link": "huudutg@gmail.com"
    }, {
        "name": "sdt",
        "link": "0984560752"
    }
    ]

}
router.get("/", async (req, res) => {
    try {
        await User.find()
            .then(data => {
                res.send(data)
            })
            .catch(err => {
                console.log('errrrr', err)
            })
    } catch (error) {
        res.send(error)
    }


});
router.get("/:id", async (req, res) => {
    const id = req.params.id;
    try {
        await User.find({ id })
            .then(data => {

                res.send(data[0])
            })
            .catch(err => {
                console.log('errrrr', err)
            })
    } catch (error) {
        console.log('error get', error)
        res.send(error)
    }


});

router.post("/", async (req, res) => {
    const body = req.body;
    const id = body.id;

    if (id) {
        try {
            const user = new User({
                id,
                name: body.name,
                list: body.list
            })
            const result = await user.save()
                .then(data => {
                    res.send(data)
                })
                .catch(err => {
                    console.log('errrrr', err)
                })
        } catch (error) {
            res.send(error)
        }

    }
    else {
        res.sendStatus(500);

    }
});

module.exports = router;
