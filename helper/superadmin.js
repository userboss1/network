
var db=require('../config/connection')
var collection =require('../config/ccollection')


module.exports={

    check:(userData)=>{
return new Promise(async(resolve,reject)=>{
    let status={}
    let user=await db.get().collection('superadmin').findOne({
        username:userData.username,
        password:userData.password
    })

    if(user){
        status=true
    }
    else{
        status=false
    }resolve(status)
})
    
    },
    getAll:()=>{
        
        return new Promise(async(resolve,reject)=>
            {
                let products=await db.get().collection(collection.ADMIN_COLLLECTION).find().toArray()
                resolve(products)
               
                
            })
    },
    newAdmin:(user1)=>{
       const list={
        username:user1.username,
        password:user1.password,
       }
       
        
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.ADMIN_COLLLECTION).insertOne(list).then((resp)=>{
                resolve()
            })
        })
    }
}