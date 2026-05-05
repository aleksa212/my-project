import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { Link } from "react-router-dom";

const LoginSchema = Yup.object().shape({
    email: Yup.string()
        .email("Invalid email format")
        .required("Email is required"),

    password: Yup.string()
        .min(6, "Password must be at least 6 characters")
        .required("Password is required"),
});

export default function Login() {
    const navigate = useNavigate();
    return (
        <div className="flex w-screen h-screen justify-center items-center">
            <div className="flex flex-col items-center space-y-4 w-80">

                <h2 className="text-xl font-semibold">Login</h2>

                <Formik
                    initialValues={{
                        email: "",
                        password: "",
                    }}
                    validationSchema={LoginSchema}
                    onSubmit={async (values) => {
                        try {
                            const res = await axios.post("http://localhost:5000/login", values);

                            localStorage.setItem("token", res.data.token);

                            navigate("/app"); // go to main app after login

                        } catch (err) {
                            alert(err.response?.data?.message || "Login failed");
                        }
                    }}
                >
                    {({ isSubmitting }) => (
                        <Form className="flex flex-col space-y-3 w-full">

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
                                {isSubmitting ? "Logging in..." : "Log in"}
                            </button>

                            {/* Signup link */}
                            <span className="text-sm text-center">
                                Don't have an account?{" "}
                                <Link to="/signup" className="text-blue-800 underline">
                                    Sign up
                                </Link>
                            </span>

                        </Form>
                    )}
                </Formik>
            </div>
        </div>
    );
}