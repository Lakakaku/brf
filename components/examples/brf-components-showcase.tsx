'use client';

import React from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Separator,
  Textarea,
  Checkbox,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui';
import {
  Building2,
  Users,
  FileText,
  Settings,
  DollarSign,
  Home,
} from 'lucide-react';

export default function BRFComponentsShowcase() {
  const [memberFormData, setMemberFormData] = React.useState({
    name: '',
    apartment: '',
    email: '',
    phone: '',
    memberType: '',
  });

  const sampleMembers = [
    {
      id: 1,
      name: 'Anna Andersson',
      apartment: 'A101',
      email: 'anna@example.com',
      status: 'Active',
      dues: '2,500 kr',
    },
    {
      id: 2,
      name: 'Erik Eriksson',
      apartment: 'B202',
      email: 'erik@example.com',
      status: 'Active',
      dues: '3,200 kr',
    },
    {
      id: 3,
      name: 'Maria Johansson',
      apartment: 'C303',
      email: 'maria@example.com',
      status: 'Pending',
      dues: '2,800 kr',
    },
  ];

  return (
    <div className='min-h-screen bg-background p-8'>
      <div className='max-w-7xl mx-auto space-y-8'>
        {/* Header */}
        <div className='text-center space-y-4'>
          <h1 className='text-4xl font-bold text-foreground'>
            BRF Portal Component Library
          </h1>
          <p className='text-xl text-muted-foreground'>
            Radix UI components styled with Tailwind CSS for Swedish BRF
            management
          </p>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue='overview' className='w-full'>
          <TabsList className='grid w-full grid-cols-6'>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='forms'>Forms</TabsTrigger>
            <TabsTrigger value='data'>Data Display</TabsTrigger>
            <TabsTrigger value='feedback'>Feedback</TabsTrigger>
            <TabsTrigger value='navigation'>Navigation</TabsTrigger>
            <TabsTrigger value='layout'>Layout</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value='overview' className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {/* BRF Management Cards */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Building2 className='h-5 w-5 text-blue-600' />
                    Property Management
                  </CardTitle>
                  <CardDescription>
                    Manage building maintenance, repairs, and property
                    information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Maintenance Requests
                      </span>
                      <Badge variant='secondary'>12 Open</Badge>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Property Value
                      </span>
                      <span className='text-sm font-medium'>45,200,000 kr</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className='w-full'>View Details</Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Users className='h-5 w-5 text-purple-600' />
                    Member Management
                  </CardTitle>
                  <CardDescription>
                    Handle member registrations, communication, and member data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Total Members
                      </span>
                      <Badge variant='default'>48</Badge>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Pending Applications
                      </span>
                      <Badge variant='outline'>3</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className='w-full'>Add New Member</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Member</DialogTitle>
                        <DialogDescription>
                          Enter the details for the new BRF member below.
                        </DialogDescription>
                      </DialogHeader>
                      <div className='space-y-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='name'>Full Name</Label>
                          <Input
                            id='name'
                            placeholder='Anna Andersson'
                            value={memberFormData.name}
                            onChange={e =>
                              setMemberFormData({
                                ...memberFormData,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='apartment'>Apartment Number</Label>
                          <Input
                            id='apartment'
                            placeholder='A101'
                            value={memberFormData.apartment}
                            onChange={e =>
                              setMemberFormData({
                                ...memberFormData,
                                apartment: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='member-type'>Member Type</Label>
                          <Select
                            value={memberFormData.memberType}
                            onValueChange={value =>
                              setMemberFormData({
                                ...memberFormData,
                                memberType: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='Select member type' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='owner'>Owner</SelectItem>
                              <SelectItem value='tenant'>Tenant</SelectItem>
                              <SelectItem value='board'>
                                Board Member
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant='outline'>Cancel</Button>
                        <Button>Add Member</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <DollarSign className='h-5 w-5 text-green-600' />
                    Financial Overview
                  </CardTitle>
                  <CardDescription>
                    Monthly fees, budgets, and financial reporting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Monthly Revenue
                      </span>
                      <span className='text-sm font-medium text-green-600'>
                        125,400 kr
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-sm text-muted-foreground'>
                        Outstanding Fees
                      </span>
                      <span className='text-sm font-medium text-red-600'>
                        8,200 kr
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant='secondary' className='w-full'>
                    View Finances
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* Forms Tab */}
          <TabsContent value='forms' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>BRF Member Registration Form</CardTitle>
                <CardDescription>
                  Example form using our component library for member
                  registration
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='full-name'>Full Name *</Label>
                    <Input id='full-name' placeholder='Anna Andersson' />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='personal-number'>Personal Number</Label>
                    <Input id='personal-number' placeholder='19850315-1234' />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='email'>Email Address</Label>
                    <Input
                      id='email'
                      type='email'
                      placeholder='anna@example.com'
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='phone'>Phone Number</Label>
                    <Input id='phone' placeholder='+46 70 123 45 67' />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='apartment-select'>Apartment</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder='Select apartment' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='a101'>A101 - 2 rooms</SelectItem>
                        <SelectItem value='a102'>A102 - 3 rooms</SelectItem>
                        <SelectItem value='b201'>B201 - 4 rooms</SelectItem>
                        <SelectItem value='b202'>B202 - 2 rooms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='move-in-date'>Move-in Date</Label>
                    <Input id='move-in-date' type='date' />
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='additional-notes'>Additional Notes</Label>
                  <Textarea
                    id='additional-notes'
                    placeholder='Any additional information or special requests...'
                    rows={3}
                  />
                </div>
                <div className='flex items-center space-x-2'>
                  <Checkbox id='terms' />
                  <Label htmlFor='terms' className='text-sm'>
                    I agree to the BRF terms and conditions and monthly fee
                    obligations
                  </Label>
                </div>
              </CardContent>
              <CardFooter className='flex justify-between'>
                <Button variant='outline'>Save as Draft</Button>
                <Button>Submit Application</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Data Display Tab */}
          <TabsContent value='data' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>Member Directory</CardTitle>
                <CardDescription>
                  Current BRF members and their information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Apartment</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-right'>Monthly Dues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleMembers.map(member => (
                      <TableRow key={member.id}>
                        <TableCell className='font-medium'>
                          {member.name}
                        </TableCell>
                        <TableCell>{member.apartment}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.status === 'Active'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right font-mono'>
                          {member.dues}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value='feedback' className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Status Badges</CardTitle>
                  <CardDescription>
                    Different status indicators for various use cases
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <Label>Member Status</Label>
                    <div className='flex gap-2'>
                      <Badge>Active</Badge>
                      <Badge variant='secondary'>Pending</Badge>
                      <Badge variant='outline'>Inactive</Badge>
                      <Badge variant='destructive'>Suspended</Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className='space-y-2'>
                    <Label>Payment Status</Label>
                    <div className='flex gap-2'>
                      <Badge className='bg-green-600'>Paid</Badge>
                      <Badge className='bg-yellow-600'>Overdue</Badge>
                      <Badge className='bg-red-600'>Defaulted</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interactive Elements</CardTitle>
                  <CardDescription>
                    Tooltips and interactive feedback
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <TooltipProvider>
                    <div className='space-y-2'>
                      <Label>Maintenance Requests</Label>
                      <div className='flex gap-2'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant='outline' size='sm'>
                              View Request #001
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Broken elevator - Priority: High</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant='outline' size='sm'>
                              View Request #002
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Heating issue Apt B202 - Priority: Medium</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Navigation Tab */}
          <TabsContent value='navigation' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle>BRF Portal Navigation</CardTitle>
                <CardDescription>
                  Example navigation structure for a BRF management system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  <Button variant='outline' className='h-24 flex-col gap-2'>
                    <Home className='h-6 w-6' />
                    <span>Dashboard</span>
                  </Button>
                  <Button variant='outline' className='h-24 flex-col gap-2'>
                    <Users className='h-6 w-6' />
                    <span>Members</span>
                  </Button>
                  <Button variant='outline' className='h-24 flex-col gap-2'>
                    <DollarSign className='h-6 w-6' />
                    <span>Finances</span>
                  </Button>
                  <Button variant='outline' className='h-24 flex-col gap-2'>
                    <Building2 className='h-6 w-6' />
                    <span>Property</span>
                  </Button>
                  <Button variant='outline' className='h-24 flex-col gap-2'>
                    <FileText className='h-6 w-6' />
                    <span>Documents</span>
                  </Button>
                  <Button variant='outline' className='h-24 flex-col gap-2'>
                    <Settings className='h-6 w-6' />
                    <span>Settings</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value='layout' className='space-y-6'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    <div>
                      <div className='text-2xl font-bold'>48</div>
                      <div className='text-sm text-muted-foreground'>
                        Total Members
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className='text-2xl font-bold text-green-600'>
                        125,400 kr
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        Monthly Revenue
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className='text-2xl font-bold text-orange-600'>
                        12
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        Pending Requests
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest updates and activities in the BRF
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    <div className='flex items-center gap-3'>
                      <Badge variant='default'>New</Badge>
                      <span className='text-sm'>
                        Erik Eriksson submitted maintenance request #013
                      </span>
                      <span className='text-xs text-muted-foreground ml-auto'>
                        2 hours ago
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <Badge variant='secondary'>Update</Badge>
                      <span className='text-sm'>
                        Monthly board meeting scheduled for March 15th
                      </span>
                      <span className='text-xs text-muted-foreground ml-auto'>
                        1 day ago
                      </span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <Badge className='bg-green-600'>Completed</Badge>
                      <span className='text-sm'>
                        Elevator maintenance completed successfully
                      </span>
                      <span className='text-xs text-muted-foreground ml-auto'>
                        3 days ago
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
