
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
    addStudents: async (classData) => {
        console.log(classData);
    
        try {
            // Convert roll and registerNumber to integers, ensure name is a string
            const studentsWithIntegerData = classData.students.map(student => ({
                name: String(student.name).trim(), // Ensure name is a string
                roll: parseInt(student.roll, 10), // Convert roll to an integer
                register: parseInt(student.register, 10), // Convert registerNumber to an integer
            }));
    
            const result = await db.get().collection("students").insertOne({
                className: String(classData.className).trim(), // Ensure class name is a string
                students: studentsWithIntegerData,
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