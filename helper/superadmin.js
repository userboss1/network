
var db=require('../config/connection')
var collection =require('../config/ccollection')

var bcrypt=require('bcrypt')
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
   

    newAdmin: async (user1) => {
        try {
            const hashedPassword = await bcrypt.hash(user1.password, 10); // Hash password with salt rounds = 10
            const list = {
                username: user1.username,
                password: hashedPassword,
            };
    
            await db.get().collection(collection.ADMIN_COLLLECTION).insertOne(list);
            return { status: true, message: "Admin created successfully" };
        } catch (error) {
            console.error("Error creating admin:", error);
            return { status: false, message: "Error creating admin" };
        }
    } ,
addStudents :async (classData) => {
    console.log(classData);
    
        try {
            const result = await db.get().collection("students").insertOne({
                className: classData.className,
                students: classData.students,
                createdAt: new Date(),
            });
            console.log("Students inserted successfully:", result.insertedId);
            return result.insertedId;
        } catch (error) {
            console.error("Error inserting students:", error);
            throw error;
        }
    }
       
}