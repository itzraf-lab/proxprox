import * as React from "react"
import { useLocation, Link } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRegister } from "@workspace/api-client-react"
import { setToken } from "@/lib/api"
import { Shell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export default function Register() {
  const [_, setLocation] = useLocation()
  const { toast } = useToast()
  const register = useRegister()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    register.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setToken(data.token)
          setLocation("/dashboard")
        },
        onError: (err: any) => {
          toast({
            title: "Registration Failed",
            description: err.data?.error || "Could not initialize account.",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <Shell>
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-none shadow-2xl border-2 border-border">
          <CardHeader className="space-y-1 pb-8 border-b bg-sidebar/30">
            <CardTitle className="text-2xl font-bold uppercase tracking-wider font-mono">System Initialization</CardTitle>
            <CardDescription className="font-mono text-xs uppercase tracking-widest text-primary">
              Register new operator account
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase tracking-wider text-xs">Operator Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} className="rounded-none bg-sidebar/10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase tracking-wider text-xs">Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="operator@system.local" {...field} className="rounded-none bg-sidebar/10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase tracking-wider text-xs">Access Code</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} className="rounded-none bg-sidebar/10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full rounded-none font-mono uppercase tracking-wider" 
                  disabled={register.isPending}
                >
                  {register.isPending ? "Initializing..." : "Initialize Account"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t bg-sidebar/30 p-4">
            <div className="text-sm font-mono text-muted-foreground">
              Existing operator? <Link href="/login" className="text-primary hover:underline underline-offset-4">System Login</Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </Shell>
  )
}
