import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { Link } from "react-router-dom";

const SignUpSchema = Yup.object().shape({
    firstName: Yup.string().required("First name is required"),
    lastName: Yup.string().required("Last name is required"),
    email: Yup.string().email("Invalid email").required("Email is required"),
    password: Yup.string().min(6, "Min 6 characters").required("Password is required"),
});

export default function SignUpForm() {
    return (
        <div className="flex w-screen h-screen justify-center items-center">
            <div className="flex flex-col items-center space-y-4 w-80">

                <h2 className="text-xl font-semibold">Sign Up</h2>

                <Formik
                    initialValues={{
                        firstName: "",
                        lastName: "",
                        email: "",
                        password: "",
                    }}
                    validationSchema={SignUpSchema}
                    onSubmit={async (values) => {
                        try {
                            await axios.post("http://localhost:5000/signup", values);
                            alert("Account created!");
                        } catch (err) {
                            alert(err.response?.data?.message || "Signup failed");
                        }
                    }}
                >
                    {({ isSubmitting }) => (
                        <Form className="flex flex-col space-y-3 w-full">

                            {/* First Name */}
                            <div className="flex flex-col">
                                <Field
                                    name="firstName"
                                    placeholder="First name"
                                    className="border w-full h-10 px-2"
                                />
                                <div className="text-red-500 text-sm">
                                    <ErrorMessage name="firstName" />
                                </div>
                            </div>

                            {/* Last Name */}
                            <div className="flex flex-col">
                                <Field
                                    name="lastName"
                                    placeholder="Last name"
                                    className="border w-full h-10 px-2"
                                />
                                <div className="text-red-500 text-sm">
                                    <ErrorMessage name="lastName" />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex flex-col">
                                <Field
                                    name="email"
                                    type="email"
                                    placeholder="Email address"
                                    className="border w-full h-10 px-2"
                                />
                                <div className="text-red-500 text-sm">
                                    <ErrorMessage name="email" />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="flex flex-col">
                                <Field
                                    name="password"
                                    type="password"
                                    placeholder="Password"
                                    className="border w-full h-10 px-2"
                                />
                                <div className="text-red-500 text-sm">
                                    <ErrorMessage name="password" />
                                </div>
                            </div>

                            {/* Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="border w-full h-10 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {isSubmitting ? "Creating..." : "Sign up"}
                            </button>

                            {/* Link */}
                            <span className="text-sm text-center">
                                Already have an account?{" "}
                                <Link to="/" className="text-blue-800 underline cursor-pointer">
                                    Log in
                                </Link>
                            </span>

                        </Form>
                    )}
                </Formik>

            </div>
        </div>
    );
}